
async function example() {
  return fetch(url).then(res => res.json()).catch(err => { throw err; });
}
