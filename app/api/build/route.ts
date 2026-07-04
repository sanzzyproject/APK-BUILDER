import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { appName, packageName, url, githubUsername, githubToken, repoName, iconBase64 } = await req.json();

  if (!githubUsername || !githubToken || !repoName) {
    return new NextResponse('Missing parameters', { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (message: string, done = false, error = false, downloadUrl?: string) => {
        const payload = JSON.stringify({ message, done, error, downloadUrl });
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      };

      try {
        send(`> Creating repository ${repoName}...`);
        const createRepoRes = await fetch('https://api.github.com/user/repos', {
          method: 'POST',
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: repoName,
            private: true,
            auto_init: true
          })
        });

        if (!createRepoRes.ok) {
           const errText = await createRepoRes.text();
           if (!errText.includes('name already exists')) {
               throw new Error(`Failed to create repo: ${errText}`);
           }
           send(`> Repository ${repoName} already exists, using it...`);
        } else {
           send(`✓ Repository ${repoName} created successfully.`);
        }

        // Delay a bit for GitHub to initialize repo
        await new Promise(r => setTimeout(r, 2000));        const safeAppName = appName.replace(/[^a-zA-Z0-9]/g, '');
        
        const files: {path: string, content: string, isBase64?: boolean}[] = [
          {
            path: '.github/workflows/build.yml',
            content: `name: Build APK
on: [push]
jobs:
  build:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'
      - run: npm install -g cordova
      - run: cordova platform add android@13.0.0
      - name: Build Cordova Android
        env:
          CORDOVA_ANDROID_GRADLE_DISTRIBUTION_URL: 'https://services.gradle.org/distributions/gradle-8.7-all.zip'
        run: cordova build android
      - uses: actions/upload-artifact@v4
        with:
          name: ${safeAppName}-APK
          path: platforms/android/app/build/outputs/apk/debug/app-debug.apk
`
          },
          {
            path: 'config.xml',
            content: `<?xml version='1.0' encoding='utf-8'?>
<widget id="${packageName}" version="1.0.0" xmlns="http://www.w3.org/ns/widgets" xmlns:cdv="http://cordova.apache.org/ns/1.0">
<name>${appName}</name>
<description>App built with APK Builder Pro</description>
<content src="index.html" />
<preference name="android-minSdkVersion" value="24" />
<preference name="android-targetSdkVersion" value="34" />
<allow-navigation href="*" />
<allow-intent href="http://*/*" />
<allow-intent href="https://*/*" />
<platform name="android">
${iconBase64 ? '<icon src="res/icon.png" />' : ''}
</platform>
</widget>
`
          },
          {
            path: 'www/index.html',
            content: `<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0">
    <meta http-equiv="Refresh" content="0; url='${url}'" />
    <script>window.location.href = "${url}";</script>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;">
    Redirecting...
</body>
</html>
`
          }
        ];

        // If user uploaded an icon, push it too
        if (iconBase64) {
           const base64Data = iconBase64.replace(/^data:image\/\w+;base64,/, "");
           files.push({
               path: 'res/icon.png',
               content: base64Data,
               isBase64: true
           });
        }

        send(`> Pushing Android project files...`);
        for (const file of files) {
          const contentEncoded = file.isBase64 ? file.content : Buffer.from(file.content).toString('base64');
          
          let sha;
          const getRes = await fetch(`https://api.github.com/repos/${githubUsername}/${repoName}/contents/${file.path}`, {
            headers: {
              'Authorization': `token ${githubToken}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          });
          if (getRes.ok) {
              const data = await getRes.json();
              sha = data.sha;
          }

          await fetch(`https://api.github.com/repos/${githubUsername}/${repoName}/contents/${file.path}`, {
            method: 'PUT',
            headers: {
              'Authorization': `token ${githubToken}`,
              'Accept': 'application/vnd.github.v3+json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: `Add ${file.path}`,
              content: contentEncoded,
              sha
            })
          });
        }
        send(`✓ Files pushed successfully.`);

        send(`> Waiting for GitHub Actions workflow to start...`);
        
        await new Promise(r => setTimeout(r, 5000));
        
        let runId;
        for (let i = 0; i < 15; i++) {
            const runsRes = await fetch(`https://api.github.com/repos/${githubUsername}/${repoName}/actions/runs`, {
                headers: {
                  'Authorization': `token ${githubToken}`,
                  'Accept': 'application/vnd.github.v3+json'
                }
            });
            if (runsRes.ok) {
                const data = await runsRes.json();
                if (data.workflow_runs && data.workflow_runs.length > 0) {
                    // Check if it's currently running or queued
                    runId = data.workflow_runs[0].id;
                    break;
                }
            }
            await new Promise(r => setTimeout(r, 4000));
        }

        if (!runId) {
            throw new Error('Workflow did not start in time. Check your GitHub repository.');
        }

        send(`✓ Workflow started (Run ID: ${runId})`);
        send(`> Building APK (this takes 1-2 minutes). Please wait...`);

        let artifactId;
        for (let i = 0; i < 60; i++) {
            const runRes = await fetch(`https://api.github.com/repos/${githubUsername}/${repoName}/actions/runs/${runId}`, {
                headers: {
                  'Authorization': `token ${githubToken}`,
                  'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (runRes.ok) {
                const runData = await runRes.json();
                if (runData.status === 'completed') {
                    if (runData.conclusion === 'success') {
                        const artsRes = await fetch(`https://api.github.com/repos/${githubUsername}/${repoName}/actions/runs/${runId}/artifacts`, {
                            headers: {
                              'Authorization': `token ${githubToken}`,
                              'Accept': 'application/vnd.github.v3+json'
                            }
                        });
                        if (artsRes.ok) {
                            const artsData = await artsRes.json();
                            if (artsData.artifacts && artsData.artifacts.length > 0) {
                                artifactId = artsData.artifacts[0].id;
                            }
                        }
                    } else {
                        throw new Error(`Build failed with conclusion: ${runData.conclusion}`);
                    }
                    break;
                }
            }
            await new Promise(r => setTimeout(r, 6000)); // Poll every 6s
        }

        if (artifactId) {
            send(`✓ Build complete! APK is ready.`);
            const downloadUrl = `/api/download?user=${githubUsername}&repo=${repoName}&artifact=${artifactId}&token=${githubToken}`;
            send('Done.', true, false, downloadUrl);
        } else {
            throw new Error('Build finished but artifact was not found.');
        }
      } catch (err: any) {
        send(`ERROR: ${err.message}`, true, true);
      }
      
      controller.close();
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
