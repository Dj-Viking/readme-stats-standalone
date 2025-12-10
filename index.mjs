import { Octokit } from "octokit"
import fs from "fs";
import { Card } from "./card.mjs";

const args = process.argv.slice(2);
const rebuild = args[0] === "rebuild";

/**
 *	@param {{login: string}} login the user object thing 
 *	@param {string} after the end cursor of the previous page 
 * */
const getNextReposFromCursorQuery = (login, after) => (`
	query getUserRepositories {
	  user(login: "${login.login}") {
		repositories(
		first: 100, 
		after: "${after}", 
		orderBy: {field: NAME, direction: ASC}
	) {
		  pageInfo {
			hasNextPage
			startCursor
			endCursor
		  }
		  nodes {
			name
			languages(
				first: 10, 
				after: null,
				orderBy: {field: SIZE, direction: DESC}	
			) {
				edges {
					node {
						color
						name
					}
				}	
				totalCount
				totalSize
			}
			url
			isPrivate
			isFork
			owner {
			  login
			}
		  }
		}
	  }
	}

`);

/**
 *	@param {{login: string}} login the user object thing 
 * */
const getFirst100ReposQuery = (login) => (`
	query getUserRepositories {
	  user(login: "${login.login}") {
		repositories(
			first: 100, 
			after: null, 
			orderBy: {field: NAME, direction: ASC}
		) {
		  pageInfo {
			hasNextPage
			startCursor
			endCursor
		  }
		  nodes {
			name
			languages(
				first: 10, 
				after: null,
				orderBy: {field: SIZE, direction: DESC}	
			) {
				edges {
					node {
						color
						name
					}
				}	
				totalCount
				totalSize
			}
			url
			isPrivate
			isFork
			owner {
			  login
			}
		  }
		}
	  }
	}
`);

async function getRepoLangInfo() {
	const pat = fs.readFileSync("./pat").toString()

	const octokit = new Octokit({
		auth: pat
	});

	const {
		data: login
	} = await octokit.rest.users.getAuthenticated();

	console.log(login.login);

	let res = await octokit.graphql(getFirst100ReposQuery(login));
	
	let nodes_to_save = [];

	console.log("firstpage: ", res.user.repositories.nodes);

	nodes_to_save = res.user.repositories.nodes.filter(n => !n.isPrivate && !n.isFork && !n.owner !== login.login);

	getrepolangs: while (true) {
		res = await octokit.graphql(getNextReposFromCursorQuery(login,
			                                             res.user.repositories.pageInfo.endCursor));
		nodes_to_save = [...nodes_to_save, ...res.user.repositories.nodes.filter(n => !n.isPrivate && !n.isFork && !n.owner !== login.login)];

		if (res.user.repositories.pageInfo.hasNextPage) {
			continue getrepolangs;
		} else {
			break getrepolangs;
		}
	}

	fs.writeFileSync("repos.json", 
		JSON.stringify(nodes_to_save, null, 4));

}

try {
	// will error if doesn't exist
	if (rebuild || !fs.statSync("./repos.json")) {
		console.log("rebuilding");
		await getRepoLangInfo();
	} else {
		const current_info = fs.readFileSync("./repos.json");
		console.log("already have som info", current_info.length);
		// TODO: generate the svg from the repo lang info
	}
} catch (e) {
	console.error("[ERROR]: json file probably doesn't exist yet we'll make it now\n", e);

	if (e instanceof Error && "path" in e) {
		switch (e.code) {
			case "ENOENT": {
				fs.writeFileSync("./repos.json", "", {encoding: "utf-8"}); 
				await getRepoLangInfo();
			} break;
		}
	}
}

