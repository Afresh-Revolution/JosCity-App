const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const source=ts.transpileModule(fs.readFileSync(require.resolve('../src/biometrics/logic.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
const mod={};vm.runInNewContext(source,{exports:mod,module:{exports:mod}});
const api=mod.default && typeof mod.default==='object'? Object.assign(mod,mod.default):mod;

test('biometric credentials round-trip and reject incomplete secrets',()=>{
  const raw=api.serializeBiometricCredentials({email:'  Ada@Jos.city ',password:'secret1',accountType:'agent'});
  const parsed=api.parseBiometricCredentials(raw);
  assert.equal(parsed.email,'ada@jos.city');
  assert.equal(parsed.password,'secret1');
  assert.equal(parsed.accountType,'agent');
  assert.equal(api.parseBiometricCredentials('{"email":"ada@jos.city","accountType":"agent"}'),null);
  assert.equal(api.parseBiometricHint('{"email":"ada@jos.city","accountType":"shop"}'),null);
});

test('auth type mapping prefers Face ID on iOS and fingerprint or biometrics on Android',()=>{
  assert.equal(api.kindFromAuthTypes([2,1],'ios'),'face');
  assert.equal(api.kindFromAuthTypes([3],'ios'),'iris');
  assert.equal(api.kindFromAuthTypes([1],'ios'),'fingerprint');
  assert.equal(api.kindFromAuthTypes([],'ios'),'generic');
  assert.equal(api.kindFromAuthTypes([2,1],'android'),'fingerprint');
  assert.equal(api.kindFromAuthTypes([2],'android'),'generic');
  assert.equal(api.kindFromAuthTypes([1],'android'),'fingerprint');
  assert.equal(api.biometricCopy('face','ios').action,'Sign in with Face ID');
  assert.equal(api.biometricCopy('face','android').noun,'Biometrics');
  assert.equal(api.biometricCopy('fingerprint','android').noun,'Fingerprint');
  assert.equal(api.biometricCopy('fingerprint','ios').noun,'Touch ID');
});

test('setup is offered only when hardware is enrolled and login is not already saved for this email',()=>{
  assert.equal(api.shouldOfferBiometricSetup({available:true,enrolled:true,enabled:false}),'setup');
  assert.equal(api.shouldOfferBiometricSetup({available:true,enrolled:true,enabled:true,enabledEmail:'old@jos.city',currentEmail:'new@jos.city'}),'update');
  assert.equal(api.shouldOfferBiometricSetup({available:true,enrolled:true,enabled:true,enabledEmail:'ada@jos.city',currentEmail:'ada@jos.city'}),'none');
  assert.equal(api.shouldOfferBiometricSetup({available:true,enrolled:false,enabled:false}),'none');
});
