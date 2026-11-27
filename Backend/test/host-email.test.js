import { test } from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import { sendBatch } from '../src/email-worker.js';

function fixture({failure=false}={}) {
  const updates=[];
  const message={id:'mail-id',application_id:'app-id',recipient:'student@example.com',event_name:'해커톤',status:'accepted',attempts:1,lock_token:'lease-id'};
  const db={
    async rpc(name) { assert.equal(name,'claim_host_emails');return {data:[message],error:null}; },
    from(table) { assert.equal(table,'email_outbox');return {
      update(values) {
        const entry={values,filters:[]};updates.push(entry);
        return {eq(...filter) { entry.filters.push(filter);return this; },then(resolve,reject) {return Promise.resolve({error:null}).then(resolve,reject);}};
      }
    }; }
  };
  const sent=[];
  const mailer={async sendMail(value) {if(failure) throw new Error('SMTP secret details');sent.push(value);}};
  return {db,mailer,updates,sent};
}
test('email worker sends result and marks leased message sent',async()=>{
  const f=fixture();
  assert.equal(await sendBatch({...f,from:'noreply@example.com'}),1);
  assert.equal(f.sent[0].to,'student@example.com');
  assert.match(f.sent[0].text,/수락/);
  assert.ok(f.updates[0].values.sent_at);
  assert.deepEqual(f.updates[0].filters,[['id','mail-id'],['lock_token','lease-id']]);
});
test('email worker schedules retry without logging credentials or recipient',async()=>{
  const f=fixture({failure:true});const logs=[];
  await sendBatch({...f,from:'noreply@example.com',logger:{error(value){logs.push(value);}}});
  assert.ok(Date.parse(f.updates[0].values.next_attempt_at)>Date.now());
  assert.equal(f.updates[0].values.lock_token,null);
  assert.equal(JSON.stringify(logs).includes('secret'),false);
  assert.equal(JSON.stringify(logs).includes('student@'),false);
});
test('installed Nodemailer renders Korean text and stable Message-ID',async()=>{
  const mailer=nodemailer.createTransport({streamTransport:true,buffer:true,newline:'unix'});
  const info=await mailer.sendMail({from:'noreply@example.com',to:'student@example.com',subject:'지원 결과',text:'수락되었습니다.',messageId:'<haema-test@haema.local>'});
  const output=info.message.toString();
  assert.match(output,/Message-ID: <haema-test@haema.local>/);
  assert.match(output,/Content-Type: text\/plain; charset=utf-8/);
  mailer.close();
});
