var noodle = require('noodlejs');


noodle.configure({
  debug: false,
  defaultDocumentType: "html"
});

var queries = {
    "url": "http://www.ouest-france.fr/liste/petite-locale-fait-du-jour/vern-sur-seiche-35770", 
    "type": "html",
    "map": {
        "link" : {
           "selector": "article a",
           "extract": ["href", "text"]
        },
        "description": {
           "selector": "article p",
           "extract": "text"
        },
        "time": {
           "selector": "article time",
           "extract": "text"
        }
    }
};

noodle.query(queries).then(function (results) {
    console.dir(results.results[0].results.time[0]);
    console.dir(results.results[0].results.description[0]);
    console.dir(results.results[0].results.link[0]);
    process.exit(code=0);
});

