/*
© 2014 Sylvain <flyinva@kabano.net>
Licence WTFPL http://www.wtfpl.net/txt/copying/

Ouest-France publie la liste des articles concernant une localité sous forme
d'une page HTML bien formatée

Ce script recupère cette page pour une localité, la parse et génère un flux RSS
avec le titre, la description, le lien et l'horodatage fournis dans la page HTML.

Le flux est affiché sur la sortie standard.


Modules NPM nécessaires :
 - request : interroge le serveur web
 - cheerio : utilisé pour parser la page à la mode jquery
 - node-rss : génération du XML/RSS

Lancement : node of.js

*/

var fs = require('fs');
var http = require('http');
var request = require('request');
var rss = require('node-rss');
require("/usr/local/lib/node_modules/node-codein");

var settings = JSON.parse(fs.readFileSync('config.json', encoding="ascii"));
httpPort = settings.httpPort || 8001;
httpHost = settings.httpHost || "127.0.0.1";
var cacheDuration = settings.cacheDuration || 120;

var httpServer = http.createServer(onRequest);
httpServer.listen(httpPort, httpHost);
console.log("Server running at http://"+ httpHost + ":" + httpPort);

function onRequest(request, response) {

	fs.stat(settings.feedsDir + request.url, function (err, stats) {
		if (err) {
			if (settings.debug) console.log('create feed');
			getFeed( settings, request, response, function() {sendFeed(settings, request, response);} );
		} else {
			var now = Date.now();
			var fileDuration = (now - stats.ctime) / 1000 / 60;

			if (settings.debug) console.log("file created " + fileDuration + " min ago");

			if ( fileDuration > settings.cacheDuration ) {
				getFeed(settings, request, response, function() {sendFeed(settings, request, response);});
			} else {
				sendFeed(settings, request, response);
			}
		} 
	});
}

/*
 * get HTML page and generate a RSS feed
 * save feed to file
 * send feed to client
*/

function getFeed(settings, httpRequest, httpResponse, callback) {
	var city = httpRequest.url;
	city = city.replace(/\//gi, "");
	var httpHost =  httpRequest.headers['x-forwarded-host'] || httpRequest.headers.host;
	var siteUrl = settings.urlBase + settings.urlPathBase + city;
	var feedLink = 'http://' + httpHost + httpRequest.url;
	
	var feed = newFeedHeader(settings, city, siteUrl, feedLink);

	console.log('GET: ' + siteUrl);

	// request page, parse and add new feed items
	request(siteUrl, function (error, response, body) {
		extractArticles(error, response, body, settings, httpRequest,  feed, callback);
	})
}

function newFeedHeader (settings, city, url, link) {
	// Define new feed options
	var feed = rss.createNewFeed(
								'Ouest France ' + city, url,
								'',
								'Flyinva <flyinva@kabano.net>',
								link, 
								{language : settings.feedLang }
								);

	return(feed);

}

function extractArticles (error, response, body, settings, request, feed, callback) {
	if (!error && response.statusCode == 200) {
		var cheerio = require('cheerio'), $ = cheerio.load(body);
		
		$('article').each( function(i, elem) { 
			htmlToFeed(i, elem, feed, this)
		});

		if (settings.debug) console.log('write: ' + settings.feedsDir + request.url);
		
		var xmlFeed = rss.getFeedXML(feed);
		writeFeedToFile(settings.feedsDir, request.url, xmlFeed, callback);

	}
}

function htmlToFeed(i, elem, feed, article){
	//console.log(that);
	var description = article.find('p').text();
	description = description.replace(/[\r\n]/gm, "");
	description = description.replace(/\s{2,}/g, "");
	
	var title = article.find('h2').text();
	title = title.replace(/[\r\n]\s{2,}/gm, "");
	title = title.replace(/\s{2,}/g, "");
	
	var url = article.find('a').attr('href');
	var time = article.find('time').attr('datetime');
	
	feed.addNewItem(title, settings.urlBase + url, time, description, {});
}

function writeFeedToFile (dir, url, feed, callback) {
	fs.writeFile(
			dir + url, 
			feed, 
			function (err) {
				if (err) throw err;
				callback();
			}
	);
}

function sendFeed(settings, httpRequest, httpResponse) {
	feed = fs.readFileSync(settings.feedsDir + httpRequest.url, 'utf8');
	httpResponse.writeHead(200, {'Content-Type': 'application/x-rss+xml'});
	httpResponse.end(feed);
	if (settings.debug) console.log('feed sent from file');
}

