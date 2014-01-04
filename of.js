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
var url = require('url');
var request = require('request');
var rss = require('node-rss');

var settings = JSON.parse(fs.readFileSync('config.json', encoding="ascii"));
httpPort = settings.httpPort || 8001;
console.log(httpPort);

var httpServer = http.createServer(onRequest);
httpServer.listen(httpPort);
console.log("Server running at http://127.0.0.1:" + httpPort);

function onRequest(request, response) {
    getFeed(settings, response, request)

}

function getFeed(settings, httpResponse, httpRequest) {
    var feedLink = url.parse(httpRequest.url).href;
    var city = url.parse(httpRequest.url).pathname;
    city = city.replace(/\//gi, "");

    // Define new feed options
    var feed = rss.createNewFeed(
                                settings.feedTitle, settings.feedSiteUrl,
                                settings.feedDescription,
                                'Flyinva <flyinva@kabano.net>',
                                feedLink, 
                                {language : settings.feedLang }
                                );

    console.log('GET: ' + settings.urlBase + settings.urlPathBase + city);

    // request page + add new feed items
    request(settings.urlBase + settings.urlPathBase + city, function (error, response, body) {
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
            
            // complete feed on stdin
            var xmlFeed = rss.getFeedXML(feed);
            httpResponse.writeHead(200, {'Content-Type': 'application/x-rss+xml'});
            httpResponse.end(xmlFeed);
        }
    })
}
