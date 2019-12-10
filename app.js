const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const app = express();

app.use(cors());
app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.send('SErver');

})

app.post('/timeStamp', (req, res) => {
    console.log(req.body);
    let process = new ffmpeg({ source: 'videos/video.webm' })
        .on('error', (err) => {
            console.log(err);

        })
        .on('end', (file) => {
            console.log('done');

        })
        .takeScreenshots({
            timemarks: ['0.8', '0.11']
        }, __dirname + '/videos')

})
app.listen(5000, () => {
    console.log('LIstening to 5000....');

})

let disableVideo = new ffmpeg({ source: 'videos/video.webm' }).withNoVideo().saveToFile('videos/noVideo.mp4');
