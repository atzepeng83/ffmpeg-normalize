const express = require('express');
const { exec } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const app = express();
app.use(express.json());

// Hilfsfunktion für sicheren Download
async function downloadFile(url, path) {
  const response = await axios({ url, method: 'GET', responseType: 'stream' });
  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(path);
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

app.post('/normalize', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).send('URL fehlt');

  const input = 'input.mp3';
  const output = 'output_podcast.mp3';

  try {
    console.log("Starte Download von", url);
    await downloadFile(url, input);
    console.log("Download abgeschlossen, starte ffmpeg");

    // Podcast Best Practice: Schön laut, ohne Clipping, Spotify-Ready!
    const ffmpegCmd = `ffmpeg -i ${input} -af "loudnorm=I=-16:TP=-1.0:LRA=11,alimiter=limit=0.97" -ar 44100 -ac 2 -b:a 192k ${output}`;

    exec(ffmpegCmd, (err, stdout, stderr) => {
      if (err) {
        console.error(stderr);
        return res.status(500).send('Fehler beim Normalisieren');
      }
      console.log("ffmpeg fertig, sende File zurück");
      res.download(output, (err) => {
        fs.unlinkSync(input);
        fs.unlinkSync(output);
      });
    });
  } catch (e) {
    console.error(e);
    res.status(500).send('Fehler beim Download');
  }
});

app.listen(3000, () => console.log('API läuft auf Port 3000'));
