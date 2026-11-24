import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mediaUrl } from '../src/lib/media-url.ts'

test('aceita links HTTP assinados sem derivar caminhos e rejeita esquemas executáveis', () => {
  const signed = 'https://storage.example/result.png?signature=abc&expires=123'
  assert.equal(mediaUrl(signed), signed)
  assert.equal(
    mediaUrl('http://localhost:9000/local/result.png'),
    'http://localhost:9000/local/result.png',
  )
  for (const value of [
    null,
    undefined,
    '',
    'raw/result.png',
    'test.example/result.jpg',
    'javascript:alert(1)',
    'data:image/png;base64,abc',
  ]) {
    assert.equal(mediaUrl(value), null)
  }
})
