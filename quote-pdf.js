// Builds and downloads a PDF quote when a customer clicks "Request a formal quote instead" on a VIP Studio page.
(function(){
var SRC='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
var QRSRC='https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
function one(src,ok,cb){if(ok())return cb();var s=document.createElement('script');s.src=src;s.onload=cb;s.onerror=cb;document.head.appendChild(s);}
function load(cb){one(SRC,function(){return !!window.jspdf;},function(){one(QRSRC,function(){return !!window.qrcode;},cb);});}
load(function(){});
var LOGO=null;(function(){var im=new Image();im.onload=function(){try{var c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);LOGO={d:c.toDataURL('image/png'),r:im.naturalWidth/im.naturalHeight};}catch(e){}};im.src='/img/ipc-logo.webp';})();
window.ipcQuotePDF=function(o){load(function(){try{
var doc=new window.jspdf.jsPDF({unit:'mm',format:'a4'}),W=210,M=20,y=22,ink=[29,29,31],grey=[110,110,115];
var txt=function(t,x,yy,sz,b,c,al){doc.setFont('helvetica',b?'bold':'normal');doc.setFontSize(sz);doc.setTextColor.apply(doc,c||ink);doc.text(t,x,yy,al?{align:al}:undefined);};
var wrap=function(t,w,sz){doc.setFontSize(sz);return doc.splitTextToSize(String(t||''),w);};
var lh=0;if(LOGO){lh=14;doc.addImage(LOGO.d,'PNG',M,y-6,lh*LOGO.r,lh);lh+=4;}
txt('Italian Printing Company',M,y+lh,LOGO?11:16,true);
txt('by Printing Italy di Angelo Cipolla',M,y+lh+5,9,false,grey);
txt('Via Lorenzo Bonincontri 26, 00147 Roma RM',M,y+lh+9.5,9,false,grey);
txt('P.IVA 02452700590 · info@italianprintingcompany.com',M,y+lh+14,9,false,grey);
txt('www.italianprintingcompany.com',M,y+lh+18.5,9,false,grey);
txt('QUOTE',W-M,y,16,true,null,'right');
txt(o.ref,W-M,y+6,10,true,null,'right');
txt(new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}),W-M,y+10.5,9,false,grey,'right');
y+=32+lh;doc.setDrawColor(210,210,215);doc.line(M,y,W-M,y);y+=8;
txt('Quote for',M,y,9,true,grey);txt('Delivery',W/2+4,y,9,true,grey);y+=5;
var L0=[o.name,o.company,o.vat?'VAT number: '+o.vat:'',o.sdi?'Codice destinatario / PEC: '+o.sdi:'',o.billing,o.email,o.phone].filter(Boolean).join('\n'),L=L0;
var R=[o.shipping,o.guest?'Registered guest: '+o.guest:'',o.guestPhone?'Mobile: '+o.guestPhone:'',o.deadline?'Event deadline: '+o.deadline:''].filter(Boolean).join('\n');
if(!L)L='\u2014';if(!R)R='\u2014';var l1=wrap(L,W/2-M-4,10),l2=wrap(R,W/2-M-4,10);
txt(l1,M,y,10);txt(l2,W/2+4,y,10);y+=Math.max(l1.length,l2.length)*4.6+8;
doc.setFillColor(245,245,247);doc.rect(M,y-5,W-2*M,8,'F');txt('Description',M+3,y,9,true,grey);txt('Amount',W-M-3,y,9,true,grey,'right');y+=9;
o.lines.forEach(function(it){var d=wrap(it.text,W-2*M-40,10);txt(d,M+3,y,10);txt(it.amount,W-M-3,y,10,true,null,'right');y+=d.length*4.6+4;doc.setDrawColor(230,230,232);doc.line(M,y-2,W-M,y-2);y+=2;});
y+=2;var row=function(a,b,big){txt(a,W-M-60,y,big?12:10,big,big?null:grey);txt(b,W-M-3,y,big?12:10,true,null,'right');y+=big?7:5.5;};
row('Subtotal',o.subtotal);row('Shipping',o.shippingCost);doc.line(W-M-60,y-3,W-M,y-3);y+=1;row('Total',o.total,true);txt('VAT included',W-M-3,y-2,8,false,grey,'right');
y+=10;var c=wrap('Prices follow the deadlines shown on '+o.url+' (Rome time). Production is authorized and starts only once payment has been received; any delay in payment delays production and delivery. The invoice is issued and sent after payment. UPS delivers during the day; a specific delivery hour can\u2019t be booked. Files: print-ready PDF at 100% final size with bleed, or a Canva editing link.',W-2*M,9);
txt(c,M,y,9,false,grey);y+=c.length*4.2+6;
txt('To confirm, reply to the email with this reference or order on the page:',M,y,9,true);
txt(String(o.url||''),M,y+4.6,9,true);
if(window.qrcode&&o.url){try{var S=26,qx=W-M-S,qy=y-5;if(qy+S+6>287){doc.addPage();qy=20;}var qr=window.qrcode(0,'M');qr.addData(String(o.url));qr.make();var n=qr.getModuleCount(),m=S/n;doc.setFillColor(29,29,31);for(var r=0;r<n;r++)for(var cc=0;cc<n;cc++)if(qr.isDark(r,cc))doc.rect(qx+cc*m,qy+r*m,m+0.02,m+0.02,'F');txt('Scan to order',qx+S/2,qy+S+4,8,false,grey,'center');}catch(e){}}
doc.save('Quote-'+o.ref+'.pdf');}catch(e){console.error(e);}});};
})();
