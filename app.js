const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const ms = require('mediaserver');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const compressing = require('compressing');


const app = express();

app.use(cors());
app.use(bodyParser.json());

let latestVideo; let nameChanged = false; let newName = ''; let format = '';
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, __dirname + '/uploads')
    },
    filename: function (req, file, cb) {
        latestVideo = file.originalname;
        //cb(null, Date.now() + '-' + file.originalname)
        cb(null, file.originalname)
    }
})

const upload = multer({ storage: storage }).single('file');


app.get('/', (req, res) => {
    res.send('SErver');

})

app.post('/convert', (req, res) => {
    console.log(req.body);
    let keys = Object.keys(req.body);
    let empty = false; let c = 0;
    keys.forEach((ele) => {
        if (req.body[ele] === 0) {
            c++;
        }

    })

    if (c === 3) {
        let setDuration = new ffmpeg({ source: `uploads/${latestVideo}` })
            .on('start', () => {
                console.log('Process started');

            })

            .on('progress', (progress) => {
                console.log('processing' + progress.percent);

            })

            .on('error', function (err) {
                console.log('Cannot process video: ' + err.message);

            })
            .on('end', function () {
                console.log('completed', defaultName(latestVideo), req.body.format);
                res.status(200).send('Processing completed');

            })

        checkFilename(req.body.filename, req.body.format, setDuration);
    }
    else {
        let startMin = req.body.startTimeMins;
        let startSecs = req.body.startTimeSecs;
        let duration = req.body.duration;
        let section = new ffmpeg({ source: `uploads/${latestVideo}` })

            .on('start', () => {
                console.log('Process started');

            })

            .on('progress', (progress) => {
                console.log('processing' + progress.percent);

            })

            .on('error', function (err) {
                console.log('Cannot process video: ' + err.message);
            })
            .on('end', function () {

                console.log('Processing finished successfully');
                res.status(200).send('Processing completed');
            })
            .setStartTime(`${startMin}:${startSecs}`)
            .setDuration(`0:${duration}`)
        checkFilename(req.body.filename, req.body.format, section);
    }


})

function frameNoDuration(req, res) {
    console.log('else part');

    let screenshot = new ffmpeg({ source: `uploads/${latestVideo}` })
        .takeScreenshots(parseInt(req.body.frames), 'images/');
    screenshot.on('end', () => {
        console.log('screenshot completed');
        const directoryPath = path.join(__dirname, 'images');
        //passsing directoryPath and callback function
        fs.readdir(directoryPath, function (err, files) {
            //handling error
            if (err) {
                return console.log('Unable to scan directory: ' + err);
            }
            //listing all files using forEach
            filenames = files.map(function (file) {
                // Do whatever you want to do with the file
                if (file !== '.DS_Store') {
                    return defaultName(file);
                }

            });
            console.log('filnames', filenames);
            res.status(200).json({
                message: 'Frames taken',
                filenames: filenames
            });
        });
    })
}



//fetch frames
app.post('/getFrames', (req, res) => {
    console.log('get frames hit', req.body);
    let filenames = [];
    const directory = 'images'
    fs.readdir(directory, (err, files) => {
        if (err) {
            console.log(err);
        }
        else {
            if (files.length != 0) {
                for (const file of files) {
                    fs.unlink(path.join(directory, file), err => {
                        if (err) throw err;
                    });
                }
            }
        }
    });
    if (req.body.startTimeMins === 0 || req.body.startTimeSecs === 0) {
        frameNoDuration(req, res);
    }
    else {
        let startMin = req.body.startTimeMins;
        let startSecs = req.body.startTimeSecs;
        let duration = req.body.duration;

        let cropPromise = new Promise((resolve, reject) => {
            new ffmpeg({ source: `uploads/${latestVideo}` })
                .setStartTime(`${startMin}:${startSecs}`)
                .setDuration(`0:${duration}`)
                .saveToFile(`cropped/${latestVideo}`)
                .on('start', () => {
                    console.log('cropping started');
                })
                .on('error', () => {
                    console.log('error occured while cropping');
                    reject();
                })
                .on('end', () => {
                    console.log('cropping ended');
                    resolve();
                })
        })

        cropPromise.then(() => {
            console.log('ran after cropping');
            let screenshot = new ffmpeg({ source: `cropped/${latestVideo}` })
                .takeScreenshots(parseInt(req.body.frames), 'images/');
            screenshot.on('end', () => {
                console.log('screenshot completed');
                const directoryPath = path.join(__dirname, 'images');
                //passsing directoryPath and callback function
                fs.readdir(directoryPath, function (err, files) {
                    //handling error
                    if (err) {
                        return console.log('Unable to scan directory: ' + err);
                    }
                    //listing all files using forEach
                    filenames = files.map(function (file) {
                        // Do whatever you want to do with the file
                        if (file !== '.DS_Store') {
                            return defaultName(file);
                        }

                    });
                    console.log('filnames', filenames);
                    res.status(200).json({
                        message: 'Frames taken',
                        filenames: filenames
                    });
                    fs.readdir('cropped', (err, files) => {
                        if (err) {
                            console.log('error fetching cropped file', err);
                        }
                        else {
                            for (const file of files) {
                                fs.unlink(path.join('cropped', file), err => {
                                    if (err) {
                                        console.log('error deleting cropped file');
                                    }
                                });
                            }
                        }
                    });
                });
            })
        })
    }

})

//play uploaded video
app.get('/video', (req, res) => {
    console.log('video hit');
    console.log('video stream', latestVideo);
    //ms.pipe(req, res, "videos/14secs.mp4");
    ms.pipe(req, res, `uploads/${latestVideo}`);
    latestVideo = '';
    ms.noCache = true;
})

//play preview
app.get('/preview', (req, res) => {
    console.log('preview hit');
    console.log(ms.mediaTypes);
    if (nameChanged) {
        console.log(`videos/${newName}.${format}`);

        ms.pipe(req, res, `videos/${newName}.${format}`);
    } else {

        ms.pipe(req, res, `videos/${latestVideo}`);
    }

    ms.noCache = true;
})

//download
app.get('/download', (req, res) => {
    console.log('download hit');

    if (nameChanged) {
        console.log(`videos/${newName}.${format}`);

        res.download(`videos/${newName}.${format}`);
        nameChanged = '';
        latestVideo = '';
    } else {
        if (format == '') {
            res.download(`videos/${latestVideo}`);
        } else {
            console.log('format', format);

            res.download(`videos/${defaultName(latestVideo)}.${format}`);
        }
        latestVideo = ''
    }

})

//single image download
app.get('/imageDownload:imgName', (req, res) => {
    console.log('image download', req.params.imgName);
    let imageName = req.params.imgName.split(':')[1];
    res.download(`images/${imageName}.png`);
})

//zip file download
app.get('/zipDownload', (req, res) => {
    console.log('zipped');

    compressing.tar.compressDir('images', 'images.zip').then(() => {
        console.log('compressed');
        res.download('images.zip')

    }).catch(() => {
        console.log('compression failed');
        res.send('Error downloading zip')
    })




})
//upload file
app.post('/upload', upload, function (req, res) {
    console.log('upload hit', req.file);
    upload(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            return res.status(500).json(err)
        } else if (err) {
            return res.status(500).json(err)
        }
        else {
            return res.status(200).send(req.file)
        }
    })
});

//play video stream
app.get('/video-stream', function (req, res) {
    console.log('stream hit');

    //const path = 'videos/webmfile.webm'
    const path = `uploads/${latestVideo}`
    const stat = fs.statSync(path)
    const fileSize = stat.size
    const range = req.headers.range
    if (range) {
        const parts = range.replace(/bytes=/, "").split("-")
        const start = parseInt(parts[0], 10)
        const end = parts[1]
            ? parseInt(parts[1], 10)
            : fileSize - 1
        const chunksize = (end - start) + 1
        const file = fs.createReadStream(path, { start, end })
        const head = {
            'Content-Range': `bytes ${start} - ${end} / ${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'video/avi',
        }
        res.writeHead(206, head);
        file.pipe(res);
    } else {
        const head = {
            'Content-Length': fileSize,
            'Content-Type': 'video/avi',
        }
        res.writeHead(200, head)
        fs.createReadStream(path).pipe(res)
    }
});

//stream images
app.get('/streamImage:name', (req, res) => {

    let imageName = req.params.name.split(':')[1];


    const path = `images/${imageName}.png`
    const stat = fs.statSync(path)
    const fileSize = stat.size
    const range = req.headers.range
    if (range) {
        const parts = range.replace(/bytes=/, "").split("-")
        const start = parseInt(parts[0], 10)
        const end = parts[1]
            ? parseInt(parts[1], 10)
            : fileSize - 1
        const chunksize = (end - start) + 1
        const file = fs.createReadStream(path, { start, end })
        const head = {
            'Content-Range': `bytes ${start} - ${end} / ${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'image/png',
        }
        res.writeHead(206, head);
        file.pipe(res);
    } else {
        const head = {
            'Content-Length': fileSize,
            'Content-Type': 'image/png',
        }
        res.writeHead(200, head)
        fs.createReadStream(path).pipe(res)
    }
})

app.listen(5000, () => {
    console.log('LIstening to 5000....');

})

function defaultName(filename) {
    console.log(filename.split('.'));
    let name = filename.split('.')[0];
    return name;
}

function checkFilename(fn, originalformat, section) {
    if (fn === '') {
        let filename = defaultName(latestVideo);
        format = originalformat;
        section.saveToFile(`videos/${filename}.${originalformat}`);
    }
    else {
        nameChanged = true;
        newName = fn;
        format = originalformat
        section.saveToFile(`videos/${fn}.${format}`);
    }
}

function screenshot() {
    let screenshot = new ffmpeg({ source: `uploads/big-buck-bunny_trailer.webm` })
        .seek(`0:10`)
        .duration(`0:07`)
        .screenshots({ count: 7, folder: 'images/' })
}

//screenshot();



//let screenshot = new ffmpeg({ source: 'videos/section.mp4' }).takeScreenshots(5, 'videos/');

//video disabled
//let disableVideo = new ffmpeg({ source: 'videos/video.webm' }).withNoVideo().saveToFile('videos/noVideo.mp4');

//audio disabled
//let disableAudio = new ffmpeg({ source: 'videos/video.webm' }).withNoAudio().saveToFile('videos/noAudio.mp4');

//changed size
//let changeSize = new ffmpeg({ source: 'videos/video.webm' }).withSize('320x240').saveToFile('videos/changedSize.mp4');

//set duration
//let setDuration = new ffmpeg({ source: 'videos/video.webm' }).setDuration('0:10').withSize('320x240').saveToFile('videos/durationSet.mp4');

//transcode particular section
//let section = new ffmpeg({ source: 'videos/video.webm' }).setStartTime('0:10').setDuration('0:05').withSize('320x240').saveToFile('videos/section.mp4');

//get codec data
// let videoMetadata = new ffmpeg.ffprobe({ source: 'videos/video.webm' }, (err, data) => {
//     if (err) {
//         console.log(err);

//     }
//     else {
//         console.log(data);

//     }
// });
