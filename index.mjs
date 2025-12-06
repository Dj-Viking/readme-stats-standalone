// @ts-check
import https from "https";
import http from "http";
import fs from "fs";
import {Card} from "./card.js";

const cert = fs.readFileSync("./cert.crt");
const cookie = fs.readFileSync("./sessioncookie");

/**
 * 
 * @param {string} path 
 * @param {string} protocol 
 * @param {string} hostname 
 * @returns 
 */
function getLangFetchGetOptions(
	path,
	protocol = "https:", 
	hostname = "api.github.com", 
) {
	return {
		protocol,
		hostname,
		path,
		method: "GET",
		headers: {
			"user-agent": "some dude lol",
			cookie: `user_session=${cookie}`
		},
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
 * @returns {Promise<RepoItem[]>}
 */
async function parseGithubJSON(repoitemsjsonstr) {
	// todo: make another request for all the lines of code for that lang for each repo and return that too
	/**
	 * @type {RepoItem[]}
	 */
	const repoitems = JSON.parse(repoitemsjsonstr);

	/**
	 * @type {Array<Promise<string>>} 
	 */
	const promises = repoitems.map((item) => {
		return new Promise(r => {
			const url = new URL(item.languages_url);
			const opts = getLangFetchGetOptions(url.pathname)

			setTimeout(() => {
				console.log('requesting next lang')
				https.get(
					opts,
					(res) => {
						let data = ""
						res.on( "data", (chunk) =>  data += chunk.toString() );
						res.on( "end", () => r(data) );
					}
				);
			}, 1000);

		});
	});
	return new Promise(async resolve => {
		const results = await Promise.all(promises);

		console.log("lang results", results);

		const json = JSON.parse(repoitemsjsonstr);
		resolve(json);
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

			/**
			 * @type {https.RequestOptions}
			 */
			const getoptions = {
				method: "GET",
				protocol: "https:",
				hostname: "api.github.com", 
				path: "/users/dj-viking/repos?per_page=140",
				headers: {
					"user-agent": "some dude lol",
					cookie: `user_session=${cookie}`
				},
				// @ts-ignore
				agentOptions: {
					ca: fs.readFileSync("./cert.crt")
				}
			};

			https.get(
				getoptions,
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
		.then((repoitems) => {
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

					${Array.isArray(repoitems) ? repoitems
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
					`) : "json was not an array"}
				</body>
				</html>
			`;

			server_res.writeHead(200, headers);
			server_res.end(testpage, "utf-8");
		}).catch(e => { throw e; });
	} catch (e) {
		console.log(e);
	}
}

const server = http.createServer((req, res) => {
	console.log("yo", req.url);
	// res.end("hello", 200);
    handlereq(req, res);
});

server.listen(8080);