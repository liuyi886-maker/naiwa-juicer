// Whole poses are sampled from an atlas. No body part is cut, rotated or reassembled.
export function runFrame(stride,cycle,count=8){return ((Math.floor(stride/cycle*count)%count)+count)%count;}
export function drawWholePose(c,im,meta,frame,x,y,height,dir=1){
 if(!im?.complete||!meta)return false;const f=meta.frames[((frame%meta.frames.length)+meta.frames.length)%meta.frames.length],scale=height/(f.height||meta.height);
 if(f.registration){c.save();c.translate(x,y);c.scale(dir*height/meta.height,height/meta.height);c.transform(...f.registration);c.drawImage(im,f.x,f.y,f.w,f.h,0,0,f.w,f.h);c.restore();return true;}
 c.save();c.translate(x,y);c.scale(dir*(meta.facing??1),1);c.drawImage(im,f.x,f.y,f.w,f.h,-f.anchorX*scale,-f.baseline*scale,f.w*scale,f.h*scale);c.restore();return true;
}
export function drawWholeRunner(c,im,meta,entity,height,cycle){if(!im?.complete||!meta?.frames?.length)return false;return drawWholePose(c,im,meta,runFrame(entity.stride,cycle,meta.frames.length),entity.x,entity.y,height,entity.dir);}
