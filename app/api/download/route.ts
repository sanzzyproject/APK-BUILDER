import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const user = url.searchParams.get('user');
  const repo = url.searchParams.get('repo');
  const artifact = url.searchParams.get('artifact');
  const token = url.searchParams.get('token');

  if (!user || !repo || !artifact || !token) {
    return new NextResponse('Missing parameters', { status: 400 });
  }

  // Get the artifact download URL
  const response = await fetch(`https://api.github.com/repos/${user}/${repo}/actions/artifacts/${artifact}/zip`, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    },
    redirect: 'manual' 
  });

  if (response.status === 302 || response.status === 301) {
    const location = response.headers.get('location');
    if (location) {
        // Proxy the S3 URL to avoid CORS and token issues
        const s3Response = await fetch(location);
        if (s3Response.ok) {
            const headers = new Headers();
            headers.set('Content-Type', 'application/zip');
            headers.set('Content-Disposition', `attachment; filename="${repo}-apk.zip"`);
            return new NextResponse(s3Response.body, { headers });
        }
        return new NextResponse(`S3 Error: ${s3Response.status}`, { status: s3Response.status });
    }
  }

  if (response.ok) {
     const headers = new Headers();
     headers.set('Content-Type', 'application/zip');
     headers.set('Content-Disposition', `attachment; filename="${repo}-apk.zip"`);
     return new NextResponse(response.body, { headers });
  }

  return new NextResponse('Failed to download artifact', { status: response.status });
}
