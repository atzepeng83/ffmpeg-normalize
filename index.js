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

// baut den ffmpeg-Befehl – mit/ohne De-Esser
function buildFfmpegCmd(input, output, useDeEsser = true) {
  const filters = [];
  if (useDeEsser) filters.push('deesser'); // konservativ: Defaults
  filters.push('loudnorm=I=-16:TP=-1.0:LRA=11');
  filters.push('alimiter=limit=0.97');
  const af = filters.join(',');
  return `ffmpeg -y -i ${input} -af "${af}" -ar 44100 -ac 2 -b:a 192k ${output}`;
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

    // 1. Versuch: mit De-Esser
    let ffmpegCmd = buildFfmpegCmd(input, output, true);
    exec(ffmpegCmd, (err, stdout, stderr) => {
      if (err) {
        const s = String(stderr || '');
        const noFilter = s.includes("No such filter") || s.includes("deesser") && s.includes("Unknown");

        if (noFilter) {
          console.warn('deesser-Filter nicht verfügbar—Fallback ohne deesser.');
          // 2. Versuch: ohne De-Esser
          const fallbackCmd = buildFfmpegCmd(input, output, false);
          return exec(fallbackCmd, (err2, stdout2, stderr2) => {
            if (err2) {
              console.error('ffmpeg Fehler (Fallback):', stderr2);
              try { if (fs.existsSync(input)) fs.unlinkSync(input); } catch {}
              try { if (fs.existsSync(output)) fs.unlinkSync(output); } catch {}
              return res.status(500).send('Fehler beim Normalisieren');
            }
            console.log("ffmpeg fertig (Fallback), sende File zurück");
            res.download(output, (e) => {
              try { if (fs.existsSync(input)) fs.unlinkSync(input); } catch {}
              try { if (fs.existsSync(output)) fs.unlinkSync(output); } catch {}
            });
          });
        }

        console.error('ffmpeg Fehler:', stderr);
        try { if (fs.existsSync(input)) fs.unlinkSync(input); } catch {}
        try { if (fs.existsSync(output)) fs.unlinkSync(output); } catch {}
        return res.status(500).send('Fehler beim Normalisieren');
      }

      console.log("ffmpeg fertig, sende File zurück");
      res.download(output, (e) => {
        try { if (fs.existsSync(input)) fs.unlinkSync(input); } catch {}
        try { if (fs.existsSync(output)) fs.unlinkSync(output); } catch {}
      });
    });
  } catch (e) {
    console.error('Download-Fehler:', e);
    try { if (fs.existsSync(input)) fs.unlinkSync(input); } catch {}
    try { if (fs.existsSync(output)) fs.unlinkSync(output); } catch {}
    res.status(500).send('Fehler beim Download');
  }
});

app.listen(3000, () => console.log('API läuft auf Port 3000'));

