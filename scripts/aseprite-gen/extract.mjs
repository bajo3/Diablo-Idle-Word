const chunks = [];
process.stdin.on('data', (d) => chunks.push(d));
process.stdin.on('end', () => {
  const text = Buffer.concat(chunks).toString('utf8');
  const json = JSON.parse(text);
  const field = process.argv[2];
  console.log(json.structuredContent[field]);
});
