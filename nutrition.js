export const keys=['protein','carbs','veg','water','fat'];
export const defaults={protein:15,carbs:6,veg:3,water:3000,fat:2};
export function servings(e){
 const n=k=>Math.max(0,Number(e[k])||0);
 if(e.mode==='grams'){
  const carbs=n('carbs')/15,protein=Math.max(0,(n('protein')-carbs*2)/7);
  return {carbs,protein,fat:Math.max(0,(n('fat')-protein*Number(e.factor||3))/5),veg:n('veg'),water:n('water')};
 }
 return Object.fromEntries(keys.map(k=>[k,n(k)]));
}
export function dateKey(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function range(day,type,today=dateKey()){
 const d=new Date(day+'T12:00:00'),start=new Date(d),end=new Date(d);
 if(type==='week'){start.setDate(d.getDate()-(d.getDay()+6)%7);end.setTime(start.getTime());end.setDate(start.getDate()+6);}
 if(type==='month'){start.setDate(1);end.setMonth(d.getMonth()+1,0);}
 if(type==='quarter'){start.setMonth(Math.floor(d.getMonth()/3)*3,1);end.setMonth(Math.floor(d.getMonth()/3)*3+3,0);}
 const from=dateKey(start),to=dateKey(end)>today&&from<=today?today:dateKey(end);
 const days=Math.round((new Date(to+'T12:00:00Z')-new Date(from+'T12:00:00Z'))/86400000)+1;
 return {from,to,days};
}
export function totals(entries){return entries.reduce((a,e)=>{const s=servings(e);keys.forEach(k=>a[k]+=s[k]);return a;},Object.fromEntries(keys.map(k=>[k,0])));}
