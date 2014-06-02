var http = require('http'),
    async = require('async'),
    exec = require('child_process').exec,
    uuid = require('node-uuid');

try {

    var DataBase = require('../class/initial.js');
    var Live = DataBase.Live,
        FBgraph = DataBase.FBgraph,
        Release = DataBase.Release;
    
    var News = Live.Object.extend("news");

    function getPost(pageId, cb) {
      FBgraph.get(pageId + '/posts?limit=10&fields=type,message,description,link,created_time,full_picture,picture', function(err, res) {
        var data = [];
        for (i=0, len=res.data.length; i<len; i++) {
          if (res.data[i].message || res.data[i].description) {
            data.push({
              "type": res.data[i].type,
              "message": (res.data[i].message || res.data[i].description),
              "picture": (res.data[i].full_picture || res.data[i].picture || ''),
              "link": res.data[i].link || '',
              "datetime": new Date(new Date(res.data[i].created_time).getTime()+8*60*60*1000).toISOString().replace(/\.\w+/i,'+08:00')
            });
          }
        }
        cb(null, data);
      });
    }

    function getPage(pageId, cb) {
        FBgraph.get(pageId, function (err, res) {
          var data = {
            "id": res.id,
            "about": res.about,
            "name": res.name,
            "cover": res.cover.source,
            "picture": "https://graph.facebook.com/" + res.id + "/picture"
          };
          cb(null, data);
        });
    }

    var query = new Live.Query(News);

    var parser = function (cb){

        query.find({
            success: function (news) {
                async.map(news, function (item, cb) {
                  getPage(item.attributes.pid, function (err, data) {
                    getPost(item.attributes.pid, function (err, post) {
                      data["post"] = post;
                      cb(null, data);
                    });
                  });
                }, function (err, results) {
                  var data = {};
                  results.forEach(function(item){
                    data[item.id] = item;
                  });
                  Release.child('news').set(data, function(err){
                    cb && cb();
                  });
                });
            },
            error: function(error) {
                throw "Fetch Channel Error: " + error.code + " " + error.message;
            }
        });
    }

  parser(function () {
      console.log(new Date(Date.now()+8*60*60*1000).toISOString().replace(/\..+/i,'') + ' News Run! ');
      process.exit(0);
  });

}
catch(err) {
    console.log('ERROR( ' + new Date(Date.now()+8*60*60*1000).toISOString().replace(/\..+/i,'') + ' ): ', err)
}
