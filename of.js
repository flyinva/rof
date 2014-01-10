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



var fs = require('fs'),
    http = require('http'),
    request = require('request'),
    rss = require('node-rss');

//require("/usr/local/lib/node_modules/node-codein");

var settings = JSON.parse(fs.readFileSync('config.json', encoding = "ascii"));
var httpPort = settings.httpPort || 8001;
var httpHost = settings.httpHost || "127.0.0.1";
var cacheDuration = settings.cacheDuration || 120;

var httpServer = http.createServer(onRequest);
httpServer.listen(httpPort, httpHost);
console.log("Server running at http://" + httpHost + ":" + httpPort);

function onRequest(request, response) {

	var objet = {};
	objet.settings = settings;
	objet.request = request;
	objet.response = response;
    
    objet.feedId = objet.request.url.replace(/.+\//,'');
    
    if (objet.settings.debug) {
        console.log('URL: ' + objet.request.url);
        console.log('feedId: ' + objet.feedId);
    }

	fs.stat(objet.settings.feedsDir + '/' + objet.feedId, function (err, stats) {
		if (err) {
			if (settings.debug) { console.log('create feed'); }
			createFeed(objet, sendFeed);
		} else {
			var fileDuration = (Date.now() - stats.ctime) / 1000;

			if (objet.settings.debug) { console.log("file created " + fileDuration + " seconds"); }
			if (fileDuration > objet.settings.cacheDuration) {
				createFeed(objet, sendFeed);
			} else {
				sendFeed(objet);
			}
		}
	});
}

/*
 * get HTML page and generate a RSS feed
 * save feed to file
 * send feed to client
*/

function createFeed(objet, callback) {
    var city, httpHost, siteUrl, feedLink, feed, newsPageUrl;
    
	//city = httpRequest.url.replace(/\//gi, "");
	city = objet.request.url;
	httpHost =  objet.request.headers['x-forwarded-host'] || objet.request.headers.host;
	siteUrl = objet.settings.urlBase + objet.request.url;
	feedLink = 'http://' + httpHost + objet.request.url;
	objet.feed = newFeedHeader(objet.settings, city, siteUrl, feedLink);

	console.log('GET: ' + siteUrl);
    // need to newsPageUrl to continue with no callback hell
	request(siteUrl, function(error, response, body) {
		findNewsPageUrl(error, response, body, objet, getNewsPage);
	});
}

function findNewsPageUrl(error, response, body, objet, callback){
    var cheerio, newsPageUrl;

    // TODO : gestion des erreurs
    
    cheerio = require('cheerio'), $ = cheerio.load(body);
    newsPageUrl = $('section.bloc-actu.actu-vignettes a.lien-all').attr('href');
    newsPageUrl = objet.settings.urlBase + newsPageUrl;
    if (objet.settings.debug) { console.log("news page: " + newsPageUrl); }
	callback(objet, newsPageUrl);
}

function getNewsPage(objet, url) {
	// request page, parse and add new feed items
	request(url, function (error, response, body) {
		extractArticles(error, response, body, objet);
		writeFeedToFile(objet, sendFeed);
	});  
}

function newFeedHeader(settings, city, url, link) {
	// Define new feed options
    var feed = rss.createNewFeed(
        'Ouest France ' + city,
        url,
		'',
		'Flyinva <flyinva@kabano.net>',
        link,
        {language : settings.feedLang }
    );

	return (feed);

}

function extractArticles(error, response, body, objet) {
	if (!error && response.statusCode === 200) {
		var cheerio = require('cheerio'), $ = cheerio.load(body);
        
		$('article').each(function (i, elem) {
			htmlToFeed(i, elem, objet.feed, this);
		});
	}
    // TODO else…
}

function htmlToFeed(i, elem, feed, article) {
    var description, title, url, time;
    
	description = article.find('p').text();
	description = description.replace(/[\r\n]/gm, "");
	description = description.replace(/\s{2,}/g, "");
	
	title = article.find('h2').text();
	title = title.replace(/[\r\n]\s{2,}/gm, "");
	title = title.replace(/\s{2,}/g, "");
	
	url = article.find('a').attr('href');
	time = article.find('time').attr('datetime');
	
	feed.addNewItem(title, settings.urlBase + url, time, description, {});
}

function writeFeedToFile(objet, callback) {
    fs.writeFile(
        objet.settings.feedsDir + '/' + objet.feedId,
        rss.getFeedXML(objet.feed),
        function (err) {
            if (err) { 
                // TODO
            } else {
                callback(objet);
            }
		}
	);
}

function sendFeed(objet) {
	feed = fs.readFileSync(objet.settings.feedsDir + '/' + objet.feedId, 'utf8');
	objet.response.writeHead(200, {'Content-Type': 'application/x-rss+xml'});
	objet.response.end(feed);
	if (objet.settings.debug) { console.log('feed sent from file'); }
}

