import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { image, section, format = 'jpeg' } = await request.json()

  const uploadUrl = process.env.N8N_JR_UPLOAD_WEBHOOK_URL
  if (!uploadUrl) {
    // Dev mode: return placeholder URL
    return NextResponse.json({
      success: true,
      url: `https://placeholder.jrpropertycleanup.com/uploads/${section}-${Date.now()}.${format}`,
      section
    })
  }

  try {
    const resp = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, section, format })
    })
    const data = await resp.json()
    return NextResponse.json({ success: true, url: data.url, section })
  } catch {
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 })
  }
}
