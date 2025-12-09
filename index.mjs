import { Octokit } from "octokit"
import fs from "fs";

const pat = fs.readFileSync("./pat").toString()

const octokit = new Octokit({
	auth: pat
});

const {
	data: login
} = await octokit.rest.users.getAuthenticated();

console.log(login.login);

const res = await octokit.graphql(`
query getUserRepositories {
  user(login: "${login.login}") {
    repositories(first: 100, after: null, orderBy: {field: NAME, direction: ASC}) {
      pageInfo {
        hasNextPage
		startCursor
        endCursor
      }
      nodes {
        name
		languages(
			first: 100, 
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

console.log("somethign", res.user.repositories.nodes);
fs.writeFileSync("repos.json", JSON.stringify(res.user.repositories.nodes.filter(n => !n.isFork && !n.isPrivate), null, 4));