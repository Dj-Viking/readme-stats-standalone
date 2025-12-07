// @ts-check
import https from "https";
import http from "http";
import fs from "fs";
import {Card} from "./card.js";

const cert = fs.readFileSync("./cert.crt");
const token = fs.readFileSync("./jwt");
const pat = fs.readFileSync("./pat");

/**
 * 
 * @param {string}   path 
 * @param {boolean?} isApp 
 * @param {string?}  body,
 * @param {"GET" | "POST"}  method,
 * @param {string?}  protocol 
 * @param {string?}  hostname 
 * @returns 
 */
function getFetchOptions(
	path,
	isApp = false,
	body = "{}",
	method = "GET",
	protocol = "https:", 
	hostname = "api.github.com", 
) {
	return {
		protocol,
		hostname,
		path,
		method,
		...(path.includes("graphql") ? { search: "query='query { viewer { login }}'" }: {}),
		...(method === "POST" ? { body } : {}),
		headers: {
			// "Content-Type": "application/graphql",
			"user-agent": "some dude lol",
			"Authorization": `${ isApp ? "Bearer" : "jwt" } ${path.includes("graphql") ? pat : token}`},
		// @ts-ignore
		agentOptions: {
			ca: cert 
		}
	}
}

/**
 * 
 * @param {unknown} info 
 * @returns 
 */
function generateStatsSVG(info) {
	// 
    // count lines of code for each language
    // output map of all langs and percentage of all the total lines of code in all my repos
	//
	const card = new Card({
		width: 500,
		height: 500,
		border_radius: 4.5,
		colors: {
			//Card title color.
          titleColor: "red",
			//Card text color.
          textColor: "green",
			//Card icon color.
          iconColor: "transparent",
			//Card background color.
          bgColor: "blue",
			//Card border color.
          borderColor: "white",
		},
		customTitle: "Most Used Languages",
		defaultTitle: "",
		titlePrefixIcon: "testicon",
	});

	return card;
}

/**
 * 
 * @param {string} repoitemsjsonstr 
 * @returns {Promise<[any[], RepoItem[]]>}
 */
async function parseGithubJSON(repoitemsjsonstr) {
	// todo: make another request for all the lines of code for that lang for each repo and return that too
	/**
	 * @type {RepoItem[]}
	 */
	const repoitems = JSON.parse(repoitemsjsonstr);

	/**
	 * @type {Array<{p: Promise<string>, url: string}>} 
	 */
	const promises = repoitems
	.filter(item => !item.fork && !item.private)
	.map((item) => {
		const url = new URL(item.languages_url);
		const opts = getFetchOptions(url.pathname)
		return {
			p: new Promise(async r => {
				// console.log('requesting next lang')
				https.get(
					opts,
					(res) => {
						let data = ""
						res.on( "data", (chunk) =>  data += chunk.toString() );
						res.on( "end", () => r(data) );
					}
				);
			}),
			url: url.pathname
		}
	});
	return new Promise(async resolve => {

		/**
		 * @type {string[]}
		 */
		let results = [];

		for (let i = 0; i < promises.length; i++) {
			const p = promises[i];
			await (async () => {
				await new Promise(res => setTimeout(async () => {
					console.log(`fetching ${i} of ${promises.length}`, "\n", p.url)
					const result = await p.p;
					results.push(result);
					res(null);
					// probably have to go really slow
					// and my rate limit is 60 and i have to make more than 60 requests to get all my language stuff
				}, 10000));
			})();
		}

		console.log("lang results", results);

		const json = JSON.parse(repoitemsjsonstr);
		resolve([results, json]);
	});
}

/**
 * 
 * @param {http.IncomingMessage} req 
 * @param {http.ServerResponse} server_res 
 * @returns 
 */
async function githubthing(req, server_res) {
	return new Promise((reslve) => {
		// @ts-ignore
		if (req.url.includes("github-stats")) {
			console.log("get stats");

			const path = "/users/dj-viking/repos?per_page=141";
			/**
			 * @type {https.RequestOptions}
			 */
			const opts = getFetchOptions(path);

			https.get(
				opts,
				(res) => {
					console.log("github api res", res.statusCode, res.statusMessage);

					// @ts-ignore
					if (res.statusCode >= 200 && res.statusCode <= 400) {
						let data = ""

						res.on("data", (chunk) => {
							// console.log("\n", chunk.toString().length);
							data += chunk.toString();
						});

						res.on("end", () => {

							console.log("typeof github api data", typeof data);
							if (typeof data === "string") {
								// console.log("json length", data.length);
							}
							console.log('finished client request')

							reslve(data);
						});

					} else {
						console.log("unexpected response from github", res.statusCode, res.statusMessage)
						let data = ""
						res.on("data", (chunk) => {
							console.log("some data from api", chunk.toString().length);
							data += chunk.toString();
						});
						console.log("bad data", data);

						reslve("bad request");
					}
				}
			);
		} else {
			server_res.end("hello", "utf-8");
		}
	})
}

/**
 * 
 * @param {http.IncomingMessage} req 
 * @param {http.ServerResponse} server_res 
 */
function handlereq(req, server_res) {
    console.log("got request", req.url);

	try {
		githubthing(req, server_res)
		.then(parseGithubJSON)
		// .then((repoitems) => {
		.then(([langresults, repoitems]) => {
			/**
			 * @type {RepoItem[]}
			 */
			let data = [];
			
			if (typeof repoitems === "string") {
				// probabaly something happened to first request
				// or the first .then was commented out for testing
				data = JSON.parse(repoitems);
			} else {
				data = repoitems;
			}
			const headers = { "Content-Type": "text/html" };

			const svg = generateStatsSVG(repoitems); 
			/**
			 * 
			 * @param {string} key 
			 * @param {*} item 
			 * @returns 
			 */
			function printitem(key, item) {
				if (typeof item[key] === "string") {
					return item[key]
				}
				else if (typeof item[key] === "boolean") {
					return item[key].toString();
				} else {
					return "unsupported"
				}
			}

			const testpage = `
				<!DOCTYPE html>
				<html lang="en">
				<head>
					<meta charset="UTF-8">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
					<title>stats boyyy</title>
				</head>
				<body>

					<div>
						${svg.render("hello world")}
					</div>

					${Array.isArray(data) ? (data
					.filter(item => Boolean(
						!item.fork && !item.private
					))
					.map(item => {
						/**
						 * @type {RepoItemKey[]}
						 */
						const keyarr = ["clone_url", "languages_url", "language"];

						return `
							<span>==============================<span>
							${Object.keys(item).filter(key => keyarr.includes(key)).map(key => {
								return `
									<p style='padding: 0; margin: 0'>
										${(() => {
											if (key === "language") {
												return "mostly using " + item[key]
											} else {
												return `${typeof item[key]} ${key}: ${printitem(key, item)}`
											}
										})()}
									</p>
								`;
							}).join(`
								<br/>
							`)}
						`;
					}).join(`
						<br/>
					`)) 
					:  (
							"json was not an array" + `
							${JSON.stringify(repoitems)}
						`
					)}
				</body>
				</html>
			`;

			server_res.writeHead(200, headers);
			server_res.end(testpage, "utf-8");
		}).catch(e => { throw e; });
	} catch (e) {
		console.log("error fetching github api\n=========\n", e);
	}
}

const server = http.createServer((req, res) => {
	console.log("yo", req.url);
	// res.end("hello", 200);
    handlereq(req, res);
});

function main () {
	server.listen(8080);
}

async function test () {
	// sequential promises
	let data = "";
	for (let i = 0; i < 3; i++) {
		await (async () => {
			await new Promise(r => setTimeout(() => {
				https.get(
					// can get rate limited so be careful lol
					// getFetchGetOptions("/users/dj-viking/repos?per_page=141", false),
					getFetchOptions("/rate_limit", false),
					// getFetchGetOptions("/app", true),
					(res) => {
						if (res.statusCode !== 200) {
							console.log("bad request", res.statusCode, res.statusMessage, res.headers)
						} else {
							console.log("response", res.statusCode, res.statusMessage, res.headers)
						}
						res.on("data", (buffer) => {
							data += buffer.toString();
						})
						res.on('end', () => {
							// console.log('tick', i, data.length, data); 
							console.log('tick', i, data.length); 
							console.log('end')
						});
					}
				)
				r(null)
			}, 1000))
			console.log("data", data.length);
		})()
	}

}

async function testgraphql() {

	let data = "";
	const query = {
		"query": `
			query {
				viewer {
					login
				}
			}
		`
	}
	const body = JSON.stringify({ query: "query { viewer { login }}" });
	for (let i = 0; i < 1; i++) {
		await (async () => {
			await new Promise(r => setTimeout(() => {
				const opts = getFetchOptions("/graphql", true, body, "GET");
				// @ts-ignore
				opts.agent = new https.Agent(opts);
				const req = https.request(
					// can get rate limited so be careful lol
					// getFetchGetOptions("/users/dj-viking/repos?per_page=141", false),
					opts,
					// getFetchGetOptions("/app", true),
					(res) => {
						if (res.statusCode !== 200) {
							console.log("bad request", res.statusCode, res.statusMessage, res.headers)
						} else {
							console.log("response", res.statusCode, res.statusMessage, res.headers)
						}
						res.on("data", (buffer) => {
							data += buffer.toString();
						})
						res.on('end', () => {
							console.log('tick', i, data.length); 
							console.log(JSON.parse(data)); 
							console.log('end')
						});
					}
				)
				req.on("error", (e) => {
					console.error("request error", e);
				})
				req.end();
				r(null)
			}, 1000))
			// console.log("data", data.length);
		})()
	}
}

// main();
// await test();

await testgraphql();