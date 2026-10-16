// Builds and downloads a PDF quote when a customer clicks "Request a formal quote instead" on a VIP Studio page.
(function(){
var SRC='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
function load(cb){if(window.jspdf)return cb();var s=document.createElement('script');s.src=SRC;s.onload=cb;document.head.appendChild(s);}
load(function(){});
window.ipcQuotePDF=function(o){load(function(){try{
var doc=new window.jspdf.jsPDF({unit:'mm',format:'a4'}),W=210,M=20,y=22,ink=[29,29,31],grey=[110,110,115];
var txt=function(t,x,yy,sz,b,c,al){doc.setFont('helvetica',b?'bold':'normal');doc.setFontSize(sz);doc.setTextColor.apply(doc,c||ink);doc.text(t,x,yy,al?{align:al}:undefined);};
var wrap=function(t,w,sz){doc.setFontSize(sz);return doc.splitTextToSize(String(t||''),w);};
txt('Italian Printing Company',M,y,16,true);
txt('by Printing Italy di Angelo Cipolla',M,y+6,9,false,grey);
txt('Via Lorenzo Bonincontri 26, 00147 Roma RM',M,y+10.5,9,false,grey);
txt('P.IVA 02452700590 · info@italianprintingcompany.com',M,y+15,9,false,grey);
txt('QUOTE',W-M,y,16,true,null,'right');
txt(o.ref,W-M,y+6,10,true,null,'right');
txt(new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}),W-M,y+10.5,9,false,grey,'right');
y+=28;doc.setDrawColor(210,210,215);doc.line(M,y,W-M,y);y+=8;
if(!L)L='\u2014';if(!R)R='\u2014';txt('Quote for',M,y,9,true,grey);txt('Delivery',W/2+4,y,9,true,grey);y+=5;
var L0=[o.name,o.company,o.vat?'VAT number: '+o.vat:'',o.sdi?'Codice destinatario / PEC: '+o.sdi:'',o.billing,o.email,o.phone].filter(Boolean).join('\n'),L=L0;
var R=[o.shipping,o.guest?'Registered guest: '+o.guest:'',o.guestPhone?'Mobile: '+o.guestPhone:'',o.deadline?'Event deadline: '+o.deadline:''].filter(Boolean).join('\n');
var l1=wrap(L,W/2-M-4,10),l2=wrap(R,W/2-M-4,10);
txt(l1,M,y,10);txt(l2,W/2+4,y,10);y+=Math.max(l1.length,l2.length)*4.6+8;
doc.setFillColor(245,245,247);doc.rect(M,y-5,W-2*M,8,'F');txt('Description',M+3,y,9,true,grey);txt('Amount',W-M-3,y,9,true,grey,'right');y+=9;
o.lines.forEach(function(it){var d=wrap(it.text,W-2*M-40,10);txt(d,M+3,y,10);txt(it.amount,W-M-3,y,10,true,null,'right');y+=d.length*4.6+4;doc.setDrawColor(230,230,232);doc.line(M,y-2,W-M,y-2);y+=2;});
y+=2;var row=function(a,b,big){txt(a,W-M-60,y,big?12:10,big,big?null:grey);txt(b,W-M-3,y,big?12:10,true,null,'right');y+=big?7:5.5;};
row('Subtotal',o.subtotal);row('Shipping',o.shippingCost);doc.line(W-M-60,y-3,W-M,y-3);y+=1;row('Total',o.total,true);txt('VAT included',W-M-3,y-2,8,false,grey,'right');
y+=10;var c=wrap('Prices follow the deadlines shown on '+o.url+' (Rome time). Production is authorized and starts only once payment has been received; any delay in payment delays production and delivery. The invoice is issued and sent after payment. UPS delivers during the day; a specific delivery hour can\u2019t be booked. Files: print-ready PDF at 100% final size with bleed, or a Canva editing link.',W-2*M,9);
txt(c,M,y,9,false,grey);y+=c.length*4.2+6;
txt('To confirm, reply to the email with this reference or order on the page: '+o.url,M,y,9,true);
doc.save('Quote-'+o.ref+'.pdf');}catch(e){console.error(e);}});};
})();
