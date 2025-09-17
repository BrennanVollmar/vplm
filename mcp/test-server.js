const http = require('http');
const port = 3333;
http.createServer((req,res)=>{ res.end('ok'); }).listen(port, '127.0.0.1', () => {
  console.log('TEST server listening on http://127.0.0.1:'+port);
});