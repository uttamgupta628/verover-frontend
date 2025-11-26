const PADDING = '000';

export function generatSpaceID(zone : string , slot : number | string){
    slot = slot.toString();
    return zone + ' ' + PADDING.substring(0, PADDING.length - slot.length) + slot;
}
export function getSpacDetailsFromID(str : string){
    const res = str.match(/^([A-Z]+) (\d\d\d)$/);
    if(res == null) {return null;}
    return {zone : res[1] , slot : parseInt(res[2])};
}

export function calculateDuration(start : string | Date , end : string | Date){
    const s = new Date(start);
    const e = new Date(end);
    let t = e.getTime() - s.getTime();
    let res = '';
    let d = 0 ;
    if(t > 1000 * 60 * 60 * 24){
      d = Math.floor(t / (1000 * 60 * 60 * 24));
      res += `${d} day${d > 1 && 's'}`;
      t -= d * 1000 * 60 * 60 * 24;
    }
    if(t > 1000 * 60 * 60){
      d = Math.floor(t / (1000 * 60 * 60));
      res += ` ${d} hour${d > 1 && 's'}`;
      t -= d * 1000 * 60 * 60;
    }
    else if(t > 1000 * 60) {
      d = Math.floor(t / (1000 * 60));
      res += ` ${d} minute${d > 1 && 's'}`;
      t -= d * 1000 * 60;
    }
    return res;
}