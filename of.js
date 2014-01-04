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
//var codein = require('node-codein');

var settings = JSON.parse(fs.readFileSync('config.json', encoding="ascii"));
httpPort = settings.httpPort || 8001;
httpHost = settings.httpHost || "127.0.0.1";

var httpServer = http.createServer(onRequest);
httpServer.listen(httpPort, httpHost);
console.log("Server running at http://"+ httpHost + ":" + httpPort);

function onRequest(request, response) {

    fs.readFile(settings.feedsDir + request.url, function (err, data) {
        if (err) {
            if (settings.debug) console.log('create feed');
            getFeed(settings, request, response);
        } else {
            if (settings.debug) console.log('send feed from file');
            sendFeed(settings, request, response);
        } 
    });
}

/*
 * get HTML page and generate a RSS feed
 * save feed to file
 * send feed to client
*/

function getFeed(settings, httpRequest, httpResponse) {
    var city = httpRequest.url;
    city = city.replace(/\//gi, "");
    var siteUrl = settings.urlBase + settings.urlPathBase + city;
    var feedLink = 'http://' + httpRequest.headers.host + httpRequest.url;

    // Define new feed options
    var feed = rss.createNewFeed(
                                'Ouest France ' + city, siteUrl,
                                '',
                                'Flyinva <flyinva@kabano.net>',
                                feedLink, 
                                {language : settings.feedLang }
                                );

    console.log('GET: ' + siteUrl);

    // request page + add new feed items
    request(siteUrl, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var cheerio = require('cheerio'), $ = cheerio.load(body);
            
            $('article').each(function(i, elem) {
                
                var description = this.find('p').text();
                description = description.replace(/[\r\n]/gm, "");
                description = description.replace(/\s{2,}/g, "");
                
                var title = this.find('h2').text();
                title = title.replace(/[\r\n]\s{2,}/gm, "");
                title = title.replace(/\s{2,}/g, "");
                
                var url = this.find('a').attr('href');

                var time = this.find('time').attr('datetime');
                
                feed.addNewItem(title, settings.urlBase + url, time, description, {});
            });
            
            var xmlFeed = rss.getFeedXML(feed);
            console.log(settings.feedsDir + httpRequest.url);
            fs.writeFile(
                    settings.feedsDir + httpRequest.url, 
                    xmlFeed, 
                    function (err) {
                        if (err) throw err;
                        sendFeed(settings, httpRequest, httpResponse);
            });
        }
    })
}

function sendFeed(settings, httpRequest, httpResponse) {
    feed = fs.readFileSync(settings.feedsDir + httpRequest.url, 'utf8');
    httpResponse.writeHead(200, {'Content-Type': 'application/x-rss+xml'});
    httpResponse.end(feed);
}

