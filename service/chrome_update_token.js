var https = require('https'),
    async = require('async');

var DataBase = require('./class/initial.js');
var Live = DataBase.Live,
    Chrome = DataBase.Chrome,
    Mobile = DataBase.Mobile,
    Release = DataBase.Release;

Chrome_Token = Chrome.Object.extend("chrome_token");
Live_Token = Live.Object.extend("chrome_token");

var token = {};
var list = [];
var query = new Chrome.Query(Chrome_Token);
var upset = new Live.Query(Live_Token);

var now = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().replace(/\..+/,'');
query.find({
  success: function(results) {
    token = {};
    list = [];
    results.forEach(function(item){
      var updateAt = new Date(item.createdAt).getTime();
      var srcToken = item.attributes.token;
      if ( /[0-9]+\/[\w]+/i.exec(srcToken) ) {
        if ( ! token[srcToken] ) {
          token[srcToken] = {
            'token': srcToken,
            'channel': item.attributes.channel,
            'responseAt': updateAt
          }
        }else if (token[srcToken]['responseAt'] < updateAt){
          token[srcToken]['responseAt'] = updateAt;
          token[srcToken]['channel'] = item.attributes.channel;
        }
        if (list.indexOf(srcToken) < 0) {
          list.push(srcToken);
        }
      }
    });

    async.parallel([
        function (cb) {
          async.each(results, function (obj, cb) {
            obj.destroy({
              'success': function(){ cb(); },
              'error': function(){ cb(); }
            });
          }, cb);
        },
        function(cb){
          async.each(list, function (item, cb) {
            upset.equalTo("token", item);
            upset.first({
              success: function(chrome_token) {
                if ( chrome_token ) {
                  chrome_token.save({
                    "responseAt": token[item]['responseAt'],
                    "channel": (token[item]['channel'] + '').split(',')
                  },{
                    success: function(chrome_token) {
                      console.log(now ,'success update', item);
                      cb();
                    },
                    error: function(chrome_token, error) {
                      console.log(now ,'failed update', item);
                      cb();
                    }
                  });
                }else{
                  chrome_token = new Live_Token();
                  chrome_token.save({
                    "token": item,
                    "responseAt": token[item]['responseAt'],
                    "channel": (token[item]['channel'] + '').split(',')
                  },{
                    success: function(chrome_token) {
                      console.log(now ,'success create', item);
                      cb();
                    },
                    error: function(chrome_token, error) {
                      console.log(now ,'failed create', item);
                      cb();
                    }
                  });
                }
              },
              error: function(error) {
                console.log(now ,'failed', item);
                cb();
              }
            });
          }, cb);
        }
    ], function () {
      process.exit(0);
    });
  },
  error: function(error) {
    console.log(error);
  }
});