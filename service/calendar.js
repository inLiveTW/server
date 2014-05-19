var https = require('https'),
    async = require('async'),
    RRule = require('rrule').RRule;
    
try {

    var DataBase = require('./class/initial.js');
    var Live = DataBase.Live,
        FBgraph = DataBase.FBgraph,
        Release = DataBase.Release;

  var Fbevent = Live.Object.extend("fbevent");
  var query = new Live.Query(Fbevent);
      query.ascending("start");
      query.limit(20);

  var parser = function (cb){
    var date = new Date().toISOString().replace(/T.*/gi, '');

    var source = [
      'https://www.googleapis.com/calendar/v3/calendars/9dvlo755f8c5lbcs9eu9hfd1g0%40group.calendar.google.com/events?key=AIzaSyBqSFbeQLYKQl80FblMuj682zvpbpPVG_o&timeZone=Asia/Taipei&timeMin=' + date + 'T00:00:00.000Z',
      'https://www.googleapis.com/calendar/v3/calendars/s6jage479tquhj3mr7abhecs48%40group.calendar.google.com/events?key=AIzaSyBqSFbeQLYKQl80FblMuj682zvpbpPVG_o&timeZone=Asia/Taipei&timeMin=' + date + 'T00:00:00.000Z'
    ];

    async.parallel({
        'google': function(cb){
          async.map(source, function (url, cb) {
            https.get(url, function(res) {
              var body = '';
              res.on('data', function(chunk) {
                body += chunk;
              });
              res.on('end', function() {
                var list = JSON.parse(body).items || [];
                cb(null, list);
              });
            }).on('error', function(e) {
              cb(null, []);
            });
          }, cb);
        },
        'facebook': function(cb){
          query.find({
            success: function(results) {
              var data = [];
              async.each(results, function(item, cb){
                FBgraph.get(item.attributes.eid, function(err, res) {
                  if (new Date(res.start_time).getTime() > new Date().getTime()) {
                    data.push(res);
                  }
                  cb(null);
                });
              }, function () {
                cb(null, data);
              });
            },
            error: function(error) {
              console.log(error);
              cb(null, []);
            }
          });
        }
    }, function (err, results) {
      var events = {};
      results['google'].forEach(function(list){
        list.forEach(function(item){
          var start = (item.start.date ? item.start.date + 'T00:00:00+08:00' : item.start.dateTime);
          if ( item.recurrence ) {
            var opt = RRule.parseString((item.recurrence+'').replace('RRULE:',''))
                opt.dtstart = new Date(start);
            var next = new RRule(opt).between(new Date(), new Date(Date.now()+14*24*60*60*1000));
            if ( next.length ) {
              start = new Date(new Date(next[0]).getTime()+8*60*60*1000).toISOString().replace(/\..+/gi,'+08:00');
              events['google_' + item.id] = {
                'type': 'google',
                'day': item.start.date ? true : false,
                'start': start,
                'end': (item.end.date ? item.end.date + 'T00:00:00+08:00' : item.end.dateTime) || '',
                'title': item.summary || '',
                'location': item.location || '',
                'link': item.htmlLink
              };
            }
          }else{
            events['google_' + item.id] = {
              'type': 'google',
              'day': item.start.date ? true : false,
              'start': start,
              'end': (item.end.date ? item.end.date + 'T00:00:00+08:00' : item.end.dateTime) || '',
              'title': item.summary || '',
              'location': item.location || '',
              'link': item.htmlLink
            };
          }
        });
      });
      results['facebook'].forEach(function(item){
        events['facebook_' + item.id] = {
          'type': 'facebook',
          'day': item.is_date_only,
          'start': (item.is_date_only ? item.start_time + 'T00:00:00+08:00' : (item.start_time+'').replace(/\+0800$/,'+08:00')) || '',
          'end': (item.is_date_only ? item.end_time + 'T00:00:00+08:00' : (item.end_time+'').replace(/\+0800$/,'+08:00')) || '',
          'title': item.name || '',
          'location': item.location || '',
          'link': 'https://www.facebook.com/' + item.id + '/'
        };
      });
      Release.child('event').set(events, cb);
    });
  };

  parser(function () {
    console.log(new Date(Date.now()+8*60*60*1000).toISOString().replace(/\..+/i,'') + ' Calendar Run!');
    process.exit(0);
  });

}
catch(err) {
    console.log('ERROR( ' + new Date(Date.now()+8*60*60*1000).toISOString().replace(/\..+/i,'') + ' ): ', err)
}
