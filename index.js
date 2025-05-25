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

  try {
    // 1. MP3 von URL runterladen
    const writer = fs.createWriteStream(input);
    const response = await axios({ url, method: 'GET', responseType: 'stream' });
    response.data.pipe(writer);

    writer.on('finish', () => {
      // 2. ffmpeg mit loudnorm ausführen
      exec(
        `ffmpeg -i ${input} -af "loudnorm=I=-16:TP=-1.5:LRA=11" -ar 44100 -ac 2 -b:a 192k ${output}`,
        (err, stdout, stderr) => {
          if (err) {
            console.error(stderr);
            return res.status(500).send('Fehler beim Normalisieren');
          }
          // 3. Normalisierte Datei zurückgeben und lokale Files löschen
          res.download(output, (err) => {
            fs.unlinkSync(input);
            fs.unlinkSync(output);
          });
        }
      );
    });

    writer.on('error', (err) => {
      console.error(err);
      res.status(500).send('Fehler beim Download');
    });
  } catch (e) {
    console.error(e);
    res.status(500).send('Allgemeiner Fehler');
  }
});

app.listen(3000, () => console.log('API läuft auf Port 3000'));
