'use client'

import Link from 'next/link'
import Image from 'next/image'
import styles from './style.module.css'
import { useSearchParams } from 'next/navigation'

export default function Other() {
  const params = useSearchParams()
  return (
    <main>
      <h1 className={styles.title}>other Page</h1>
      <p className={styles.msg}>this is other page だよ</p>
      <div>
        <Image src="/tech1pos.png" alt="" width={900} height={900} />
      </div>
      <ol>
        <li className="msg">Name: {params.get('name')}</li>
        <li className="msg">Mail: {params.get('mail')}</li>
        <li className="msg">Age: {params.get('age')}</li>
      </ol>
      <div>
        <Link href="/">絶対パスのリンクなので　/ だけ</Link>
      </div>

    </main>
  )
}