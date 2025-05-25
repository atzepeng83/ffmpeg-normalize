const express = require('express');
const { exec } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const app = express();
app.use(express.json());

app.post('/normalize', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).send('URL fehlt');

  const input = 'input.mp3';
  const output = 'output_normalized.mp3';

  // 1. Datei runterladen
  const writer = fs.createWriteStream(input);
  const response = await axios({ url, method: 'GET', responseType: 'stream' });
  response.data.pipe(writer);
  writer.on('finish', () => {
    // 2. ffmpeg-normalize ausführen
    exec(`ffmpeg-normalize ${input} -o ${output} -c:a mp3 --normalization-type ebu`, (err, stdout, stderr) => {
      if (err) return res.status(500).send('Fehler beim Normalisieren');
      // 3. Datei zurückgeben
      res.download(output);
    });
  });
});

app.listen(3000, () => console.log('API läuft auf Port 3000'));
