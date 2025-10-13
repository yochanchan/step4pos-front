'use server'
import { redirect } from 'next/navigation'

const url = 'http:localhost:3000/sample.json'

export async function serverAction(form) {
  const num = form.get("input")
  const res = await fetch(
    url,
    { cache: 'no-store' }
  )
  const result = await res.json()
  let data = result.data[num]
  if (data == null) {
    data = { name: '-', mail: '-', age: 0 }
  }
  const query = 'name=' + data.name +
    '&mail=' + data.mail +
    '&age=' + data.age
  const searchParams = new URLSearchParams(query)
  redirect('/other?' + searchParams.toString())
}