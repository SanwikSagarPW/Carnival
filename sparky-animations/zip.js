// Dependency-free ZIP writer using STORE entries and CRC32.
const table=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function makeZip(files){
 const parts=[],central=[];let offset=0,size=0;
 const enc=new TextEncoder();
 for(const {name,data} of files){
  if(name.startsWith('/')||name.split('/').includes('..'))throw Error('Unsafe archive path');
  const filename=enc.encode(name),bytes=typeof data==='string'?enc.encode(data):new Uint8Array(data);let crc=0xffffffff;
  for(const b of bytes)crc=table[(crc^b)&255]^(crc>>>8);crc=(crc^0xffffffff)>>>0;
  const header=new Uint8Array(30),v=new DataView(header.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,filename.length,true);
  parts.push(header,filename,bytes);
  const c=new Uint8Array(46),w=new DataView(c.buffer);w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint16(8,0x800,true);w.setUint32(16,crc,true);w.setUint32(20,bytes.length,true);w.setUint32(24,bytes.length,true);w.setUint16(28,filename.length,true);w.setUint32(42,offset,true);central.push(c,filename);offset+=30+filename.length+bytes.length;size+=46+filename.length;
 }
 const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,size,true);v.setUint32(16,offset,true);
 return new Blob([...parts,...central,end],{type:'application/zip'});
}
