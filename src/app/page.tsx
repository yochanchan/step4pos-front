'use client'

import { useRef, useState } from 'react';
import { preconnect } from 'react-dom';

type DealPayload = {
  cartpayload: number[];
  amountpayload: number;
}




export default function Home() {

  type Nakami = {
    code: number;
    name: string;
    price: number;
  }



  const [name, setName] = useState<string>("-");
  const [price, setPrice] = useState<number>(0);
  const [nakami, addNakami] = useState<Nakami[]>([]);
  const itemCode = useRef<HTMLInputElement>(null!);
  const cartRef = useRef<number[]>([])

  const APIURL = process.env.NEXT_PUBLIC_API_ENDPOINT

  let pre_info = { name: "-", kazu: 0, price: 0, ammount: 0 };

  /* 読み込み部分 */
  function setCode() {
    fetchCode().then(res => {
      setName(res.name)
      setPrice(res.price)
    });
  }

  async function fetchCode() {
    const param = "/item?prd_code=";
    const url = APIURL + param
    const res = await fetch(
      url + itemCode.current.value,
      { cache: 'no-store' }
    );
    const result = await res.json();
    pre_info = result;
    return result;
  }


  /* 追加部分 */
  function toCart() {
    cartRef.current.push(Number(itemCode.current.value))
    console.log(cartRef)
  }


  function toList() {
    addNakami([
      ...nakami,
      { code: 1, name: name, price: price }
    ]);
    console.log(nakami)
  }

  function Cart() {

    return (
      <div>
        <ul>
          {nakami.map((i, k) => {
            return (<li className="text-left" key={k}>{i.name}　x1　{i.price}円　{i.price}円</li>)
          }
          )}
          <li></li>
        </ul>
      </div>
    );
  }


  async function Deal() {
    const param = "/deal";
    const url = APIURL + param;
    let amount = 0;
    console.log(nakami.length)

    for (let i = 0; i < nakami.length; i++) {
      amount = amount + nakami[i].price;
    }

    const payload: DealPayload = {
      cartpayload: cartRef.current,
      amountpayload: amount
    };
    const res = await fetch(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );
  }


  return (
    <main>
      <div className="w-5/8 bg-gray-300">
        <div className="grid grid-cols-2 gap-2">
          <div className="m-2 p-4 border-solid bg-blue-100">
            <form>
              <input className="input"
                type="number"
                ref={itemCode}
              />
            </form>
            <button className="btn my-3" onClick={setCode}>商品コード 読み込み</button>
            <div className="my-3">{name}</div>
            <div>{price}</div>
            <button className="btn my-3" onClick={() => { toCart(); toList(); }}>追加</button>
          </div>
          <div className="m-2 p-4 bg-amber-100">
            <p className="msg text-center">購入リスト</p>
            <Cart />
            <button className="btn" onClick={() => { Deal() }}>購入</button>
          </div>
        </div>
      </div>
    </main >
  );

}