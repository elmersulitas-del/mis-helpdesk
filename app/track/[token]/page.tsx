import Link from 'next/link';
import TrackTicket from '@/components/TrackTicket';export default async function Page({params}:{params:Promise<{token:string}>}){const {token}=await params;return <main className="shell track"><Link href="/">← Submit another concern</Link><br/><br/><TrackTicket token={token}/></main>}
