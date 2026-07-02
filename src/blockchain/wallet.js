import { AppConfig, UserSession, showConnect } from '@stacks/connect';

const appConfig = new AppConfig(['store_write']);
export const userSession = new UserSession({ appConfig });

export function isWalletConnected(){
  return userSession.isUserSignedIn();
}

export function getWalletAddress(){
  if(!isWalletConnected()) return '';
  const user = userSession.loadUserData();
  return user?.profile?.stxAddress?.testnet || user?.profile?.stxAddress?.mainnet || '';
}

export function connectWallet(onFinish){
  showConnect({
    appDetails:{
      name:'STX Solitaire',
      icon: window.location.origin + '/favicon.svg'
    },
    userSession,
    onFinish:()=>{
      onFinish?.(getWalletAddress());
    }
  });
}

export function disconnectWallet(){
  userSession.signUserOut('/');
}
