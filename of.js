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
 - sha1

Lancement : node of.js

*/

// use as database to stored called URL and new page URL
var database = {};
GLOBAL.database = database;

var fs = require('fs'),
    http = require('http'),
	url = require('url'),
    request = require('request'),
    rss = require('node-rss'),
	sha1 = require('sha1');

//require("/usr/local/lib/node_modules/node-codein");

var settings = JSON.parse(fs.readFileSync('config.json', encoding = "ascii"));
var httpPort = settings.httpPort || 8001;
var httpHost = settings.httpHost || "127.0.0.1";
var cacheDuration = settings.cacheDuration || 120;

var httpServer = http.createServer(onRequest);
httpServer.listen(httpPort, httpHost);
console.log("Server running at http://" + httpHost + ":" + httpPort);

function onRequest(request, response) {

	var objet = {}, urlParts;
	objet.settings = settings;
	objet.request = request;
	objet.response = response;
	objet.feedId = sha1(objet.request.url);
    
    if (objet.settings.debug) {
        console.log('URL: ' + objet.request.url);
        console.log('feedId: ' + objet.feedId);
    }

    if ( ! database[objet.feedId] ) {
        if (settings.debug) { console.log('feedId not in database'); }
        findNewsPageUrl(objet, isFeedInCache);
    } else {
        if (settings.debug) { console.log('feedId in database : ' + database[objet.feedId]); }
        isFeedInCache(objet, database[objet.feedId]);
    }
}

function isFeedInCache (objet, url) {
    
    var file;
    file = objet.feedId;
    
    if (settings.debug) { 
        console.log('is ' + url + ' in cache ?');
        console.log('file: ' + objet.settings.feedsDir + '/' + file );
    }
    
    objet.feed = newFeedHeader(objet, url);
        
    fs.stat(objet.settings.feedsDir + '/' + file, function (err, stats) {
		if (err) {
			if (settings.debug) { console.log('no, creating feed'); }
			getNewsPage(objet, url, sendFeed);
		} else {
			var fileDuration = (Date.now() - stats.ctime) / 1000;

			if (objet.settings.debug) { console.log("yes from " + fileDuration + " seconds"); }

			if (fileDuration > objet.settings.cacheDuration) {
                if (settings.debug) { console.log('too old, creating feed'); }
				getNewsPage(objet, url, sendFeed);
			} else {
				sendFeed(objet);
			}
		}
	});
}

function findNewsPageUrl(objet, callback){
    var cheerio, siteUrl, newsPageUrl;

    siteUrl = objet.settings.urlBase + objet.request.url;
    
    // get the page to extract local news page URL
    // cb : get local news page and create the feed
    request(siteUrl, function(error, response, body) {
		// TODO : gestion des erreurs
        cheerio = require('cheerio'), $ = cheerio.load(body);
        newsPageUrl = $('section.bloc-actu.actu-vignettes a.lien-all').attr('href');
        database[objet.feedId] = newsPageUrl;
        
        if (objet.settings.debug) { console.log("news page: " + newsPageUrl); }

        callback(objet, newsPageUrl);
	});
}

function getNewsPage(objet, url, callback) {
    
    url = objet.settings.urlBase + url;
    
	if (objet.settings.debug) { console.log("GET local news page from " + url) };

	// request page, parse and add new feed items
	request(url, function (error, response, body) {
		extractArticles(error, response, body, objet);
		writeFeedToFile(objet, sendFeed);
	});  
}

function newFeedHeader(objet, url) {
    var httpHost, siteUrl, feedLink, city;
    
    // TODO get title from news page
    city = '';
    httpHost =  objet.request.headers['x-forwarded-host'] || objet.request.headers.host;
	feedLink = 'http://' + httpHost + objet.request.url;
    
	// Define new feed options
    var feed = rss.createNewFeed(
        'Ouest France ' + city,
        objet.settings.urlBase + url,
		'',
		'Flyinva <flyinva@kabano.net>',
        feedLink,
        {language : objet.settings.feedLang }
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
    
    if (objet.settings.debug) { console.log("writing " + objet.feedId) };
    
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

