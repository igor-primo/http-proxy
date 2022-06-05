
/*
 * This is an http proxy I made as an attempt to reclaim freedom to see what
 * I wish. This proxy can filter media content by dropping http packets
 * containing a media content-type referring to videos or images.
 * It works wonders with http sites, but not so well with https on
 * account of HSTS policy, unfortunately. Until I find a workaround
 * one better learn to survive in a text web browser.
 */

const https = require('https');
const http = require('http');
const net = require('net');
const fs = require('fs');

function handler_http(req, res){
	const {url, method, headers} = req;
	/* make request on behalf of the client */
	let proxy = http.request(url, {method, headers}, resp => {
		const ct = resp.headers['content-type'];
		console.log(ct); //DEBUG
		if(ct && !ct.includes('image') && !ct.includes('video')){
			const code = resp.statusCode;
			const headers = resp.headers;
			res.writeHead(code, headers);
			resp.pipe(res, {end: true});
		} else 
			res.end();
	});

	req.pipe(proxy, {end: true});
}

function handler_https(req, res){
	const {url, method, headers} = req;
	/* create the real url */
	const real_url = 'https://' + headers['host'] + url;
	let proxy = https.request(real_url, {method, headers}, resp => {
		const ct = resp.headers['content-type'];
		console.log(ct); //DEBUG
		if(ct && !ct.includes('image') && !ct.includes('video')){
			const code = resp.statusCode;
			const headers = resp.headers;
			console.log(headers); //DEBUG
			res.writeHead(code, headers);
			resp.pipe(res, {end: true});
		} else 
			res.end();
	});

	req.pipe(proxy, {end: true});
}

/* load self signed cert */
const opt = {
	key: fs.readFileSync('./key.pem'),
	cert: fs.readFileSync('./cert.pem'),
}

const server = net.createServer();

server.on('error', err => console.log(err)); //DEBUG
server.on('close', _ => console.log('client disconnected')); //DEBUG
server.on('connection', client => {
	client.once('data', chunk => {
		let is_tls = chunk.toString().indexOf('CONNECT') !== -1;
		/* assume we are talking about http */
		let server_port = 5002;
		let server_address = 'localhost';
		if(is_tls)
			server_port = 5001;

		let proxy = 
			net.createConnection({host: server_address, port: server_port}, _ => {
				if(is_tls)
					client.write('HTTP/1.1 200 OK\r\n\n');
				else
					proxy.write(chunk);

				// pipes
				client.pipe(proxy);
				proxy.pipe(client);

				proxy.on('error', err => console.log(err)); //DEBUG

			});
		client.on('error', err => console.log(err)); //DEBUG
	});
}); 

http.createServer(handler_http).listen(5002);
https.createServer(opt, handler_https).listen(5001);

server.listen(5000, _ => console.log('listening at 5000')); //DEBUG
