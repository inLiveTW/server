inLiveTW for Server
====

## 直播

### Source

> GET  https://livelink.firebaseio.com/live/.json

### 欄位

| 欄位名稱 | 類型 | 說明|
| --- | --- | --- |
| cid | string | 頻道ID |
| vid | string | 直播ID |
| vuid | string | 頻道每次直播的唯一碼 |
| type | ustream / youtube | 直播類型 |
| location | string | 位置 |
| url | string | 直播超連結 |
| updated_at | timestamp | 最後更新的時間 |
| logo | string | 識別圖 |
| title | string | 標題 |
| status | live / offlive | 狀態 |

### Samlpe JSON

```
y_zxwBWUT-gIM: {
  cid: "UC6BgDThjkr6sEOovgcrvXjQ",
  vid: "zxwBWUT-gIM",
  vuid: "53549df1-9e86-4807-8623-b1962b3f6bdc",
  location: "測試用頻道",
  latlngColumn: "緯度,經度",
  type: "youtube",
  url: "http://youtu.be/zxwBWUT-gIM",
  user: "UC6BgDThjkr6sEOovgcrvXjQ",
  updated_at: 1400339403,
  logo: "https://yt3.ggpht.com/-vV6oOnvGfZM/AAAAAAAAAAI/AAAAAAAAAAA/4XC88oZ10UY/s100-c-k-no/photo.jpg",
  title: "05/06 2:00 Activation Tube_2",
  status: "live"
}
```


## 頻道

> GET  https://livelink.firebaseio.com/channel/.json

### 欄位

| 欄位名稱 | 類型 | 說明|
| --- | --- | --- |
| cid | string | 頻道ID |
| type | ustream / youtube | 頻道類型 |
| url | string | 頻道超連結 |
| logo | string | 識別圖 |
| title | string | 標題 |

### Samlpe JSON

```
y_eGbBclLIMoK8wzq2Mzsl8Q: {
  type: "youtube",
  url: "http://www.youtube.com/channel/UCeGbBclLIMoK8wzq2Mzsl8Q",
  cid: "eGbBclLIMoK8wzq2Mzsl8Q",
  logo: "http://yt3.ggpht.com/-Y3ISOi_zAqc/AAAAAAAAAAI/AAAAAAAAAAA/AYkPlWTz3Uc/s88-c-k-no/photo.jpg",
  title: "g0v.tw 台灣零時政府"
}
```

## 報導

> GET  https://livelink.firebaseio.com/news/.json

### 欄位

| 欄位名稱 | 類型 | 說明|
| --- | --- | --- |
| id | string | ID |
| name | string | 媒體名稱 |
| cover | string | 封面 |
| about | string | 介紹 |
| picture | string | 識別圖 |
| post | array | 報導 |

### POST 欄位

| 欄位名稱 | 類型 | 說明|
| --- | --- | --- |
| datetime | datetime | 刊登的日期時間 |
| type | status / video / photo | 類型 |
| picture | string | 照片 |
| message | string | 訊息 |
| link | string | 報導超連結 |

### Sample JSON
```
454607821247176: {
  name: "g0v.tw 台灣零時政府",
  cover: "https://fbcdn-sphotos-a-a.akamaihd.net/hphotos-ak-frc3/t1.0-9/s720x720/1469755_631013096939980_359006607_n.png",
  about: "g0v - 寫程式改造社會 採訪/邀約：... ",
  picture: "https://graph.facebook.com/454607821247176/picture",
  id: "454607821247176",
  post: [
  {
    datetime: "2014-04-25T17:07:20+0000",
    type: "link",
    link: "https://www.facebook.com/cy.sunshine/posts/583688765076974",
    message: "【政治獻金數位化】新關卡開啟！...",
    picture: "https://fbexternal-a.akamaihd.net/safe_image.php?d=AQCJtyx1HvT9JOkj&url=https%3A%2F%2Ffbcdn-profile-a.akamaihd.net%2Fhprofile-ak-frc1%2Ft1.0-1%2Fp100x100%2F1001984_589250677854116_2145594619054605661_a.png"
  },
  {
    datetime: "2014-04-20T14:55:01+0000",
    type: "photo",
    link: "https://www.facebook.com/g0v.tw/photos/a.456791061028852.107377.454607821247176/706021376105818/?type=1&relevant_count=1",
    message: "【政治獻金數位化】鄉民 OCR...",
    picture: "https://fbexternal-a.akamaihd.net/safe_image.php?d=AQCjFk0WwoKdD1Kb&url=https%3A%2F%2Ffbcdn-photos-f-a.akamaihd.net%2Fhphotos-ak-frc3%2Ft1.0-0%2F10291771_706021376105818_4432992331619430129_s.jpg"
  }...]
}
```



## 事件

> GET  https://livelink.firebaseio.com/event/.json

### 欄位

| 欄位名稱 | 類型 | 說明|
| --- | --- | --- |
| location | string | 位置 |
| type | google / facebook | 來源類型 |
| link | string | 事件超連結 |
| title | string | 標題 |
| start | datetime | 開始日期時間 |
| end | datetime | 結束日期時間 |
| day | bool | 是否全天 |

### Sample JSON
```
google_dka7hun4bmno7u362hhl6dln7k: {
  location: "國立臺灣大學普通教學大樓102教室",
  type: "google",
  link: "https://www.google.com/calendar/event?eid=ZGthN2h1bjRibW5vN3UzNjJoaGw2ZGxuN2sgczZqYWdlNDc5dHF1aGozbXI3YWJoZWNzNDhAZw",
  title: "【 教育決定台灣的未來？ ─ 從歷史課本爭議談起 研討會】",
  start: "2014-05-18T09:00:00+08:00",
  end: "2014-05-18T17:00:00+08:00",
  day: false
}
```

## License

CC0 1.0 Universal

To the extent possible under law, YuTin Liu has waived all copyright and related or neighboring rights to inLiveTW.

This work is published from Taiwan.

http://creativecommons.org/publicdomain/zero/1.0
