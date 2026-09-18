import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "";
  if (json.trim()) {
    const serviceAccount = JSON.parse(json);
    if (serviceAccount.private_key) serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
    return initializeApp({
      credential: cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "coaching-management-system-new.firebasestorage.app",
    });
  }
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
    throw new Error("Firebase Admin is not configured. Add FIREBASE_SERVICE_ACCOUNT_JSON in Vercel and redeploy.");
  }
  return initializeApp({
    credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "coaching-management-system-new.firebasestorage.app",
  });
}

async function requireUser(req) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) { const e=new Error("Authentication required."); e.statusCode=401; throw e; }
  const app=getAdminApp();
  const adminAuth=getAuth(app); const firestore=getFirestore(app);
  const decoded=await adminAuth.verifyIdToken(authHeader.slice(7));
  const userSnap=await firestore.collection("users").doc(decoded.uid).get();
  return { app, adminAuth, firestore, decoded, userProfile:userSnap.exists ? userSnap.data() : null };
}

export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  try{
    const { app, firestore, decoded, userProfile }=await requireUser(req);
    const body=req.body||{};
    const kind=body.kind;
    const path=String(body.path||"");
    const contentType=String(body.contentType||"");
    const data=String(body.data||"");
    if(!["student-profile","director"].includes(kind)) return res.status(400).json({error:"Invalid upload type."});
    if(!/^image\/(jpeg|png|webp|gif)$/.test(contentType)) return res.status(400).json({error:"Only JPG, PNG, WEBP or GIF images are allowed."});
    const raw=Buffer.from(data,"base64");
    if(!raw.length) return res.status(400).json({error:"Image data is empty."});
    if(raw.length>5*1024*1024) return res.status(413).json({error:"Image must be 5 MB or smaller."});
    const cleanPath=path.replace(/^\/+/,"");
    if(kind==="director"){
      if(userProfile?.role!=="admin") return res.status(403).json({error:"Only an admin can upload the director photo."});
      if(cleanPath!=="director/profile") return res.status(400).json({error:"Invalid director upload path."});
    }else{
      const match=cleanPath.match(/^students\/([^/]+)\/profile$/);
      if(!match) return res.status(400).json({error:"Invalid student photo path."});
      const studentId=match[1];
      const studentSnap=await firestore.collection("students").doc(studentId).get();
      if(!studentSnap.exists) return res.status(404).json({error:"Student profile not found."});
      const student=studentSnap.data()||{};
      if(userProfile?.role!=="admin" && student.authUid!==decoded.uid) return res.status(403).json({error:"You can only upload your own profile photo."});
    }
    const ext={"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif"}[contentType]||"jpg";
    const objectPath=`${cleanPath}/${Date.now()}-${Math.random().toString(36).slice(2,9)}.${ext}`;
    const bucket=getStorage(app).bucket();
    const file=bucket.file(objectPath);
    await file.save(raw,{resumable:false,metadata:{contentType,cacheControl:"public,max-age=31536000"}});
    const [url]=await file.getSignedUrl({action:"read",expires:"2500-01-01"});
    return res.status(200).json({success:true,url,path:objectPath});
  }catch(error){
    console.error("Admin image upload error",error);
    return res.status(error?.statusCode||500).json({error:error?.message||"Image upload failed.",code:error?.code||"unknown-error"});
  }
}
