/*
Sur le site OF, chaque ville a sa propre page de news.
Un web service permet de trouver cette page d'après le nom. Il renvoie un JSON avec la liste des villes qui matchent. Le web service peut répondre avec un seul caractère saisi (même si l'interface web commence à 3).

Ce script interroge le web service pour chaque lettre de l'alphabet pour obtenir la liste complete (on interroge le web service pour a puis pour b, etc.).

Il concatène le résultat et fabrique une liste compatible avec l'autocomplétion de jQuery 

*/
var fs = require('fs');
var request = require('request-json');
var client = request.newClient('http://www.ouest-france.fr');
var async = require('async');
var alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');

var localisations = new Array();
var cities = new Object();

var getLocalisation = function getLocalisation(character, cb) {
    client.get('/recherche/commune/' + character, function(err, res, body) {
            if ( err){
                console.log('error:' + character);
                cb(err);
            } else {
                cb(null, body.localisations);
            }
     });
}

async.map(alphabet, getLocalisation, function(err, results){
    var length = results.length;
    for (i = 0; i < length; i++) {
        localisations = localisations.concat(results[i]);
    }
 
    length = localisations.length;
    for (i = 0; i < length; i++) {
        if ( localisations[i].url != '') {
            cities[localisations[i].libelle] = localisations[i].url.replace(/\/.+\/.+\/(.+)#resultat-recherche/, "$1");
        } 
    }

    //console.log(JSON.stringify(localisationsFinal));
    fs.writeFileSync('cities.json', JSON.stringify(cities));
    console.log('cities.json');
});

