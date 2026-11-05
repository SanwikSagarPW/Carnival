// Rest-space targets measured against reference.png. The head's existing +2 Y
// placement is applied by its mesh binding, so these targets exclude that lift.
export const FACE_FIT={
 EyeWhite_L:[-63,220,-11,269],EyeWhite_R:[17,220,67,269],
 EyeHalf_L:[-63,220,-11,269],EyeHalf_R:[17,220,67,269],
 EyeClosed_L:[-61,230,-12,242],EyeClosed_R:[18,230,65,242],
 Iris_L:[-49,223,-17,259],Iris_R:[22,223,54,259],
 Brow_L:[-52,272,-23,285],Brow_R:[28,272,57,285],
 Nose:[-6,224,11,232],
 Mouth_Smile:[-17,211,22,219],Mouth_Happy:[-17,199,22,219],
 Mouth_Laugh:[-17,197,22,219],Mouth_Talk:[-16.5,203,21.5,219],
 Mouth_A:[-10.5,200,15.5,219],Mouth_Teeth:[-16,211,21,219],
 Mouth_O:[-7,204,12,219],Mouth_U:[-5,209,10,219],
 Mouth_FV:[-15,213,20,219],Mouth_Sad:[-15,213,20,219],
};
export function fitFacePoint(name,p,bounds){
 const t=FACE_FIT[name];if(!t)return p;
 return[t[0]+(p[0]-bounds[0])*(t[2]-t[0])/(bounds[2]-bounds[0]),t[1]+(p[1]-bounds[1])*(t[3]-t[1])/(bounds[3]-bounds[1])];
}
// Rhubarb A is closed M/B/P; G is F/V. Unknown/silent cues stay at rest.
export const VISEMES=Object.freeze({X:'Smile',A:'Smile',B:'Teeth',C:'Talk',D:'A',E:'O',F:'U',G:'FV',H:'Talk'});
export function mouthForSpeech(shape,nativeShape){return VISEMES[shape??nativeShape]??'Smile'}
