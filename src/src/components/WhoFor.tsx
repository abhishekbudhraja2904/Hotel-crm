const one = (x: any) => (Array.isArray(x) ? x[0] : x)
// "Who is this for": the client's name and phone, shown at the top of every pop-up where something is typed.
export default function WhoFor({ inquiry, c }: { inquiry?: any; c?: any }) {
  const cu = one(c ?? inquiry?.customers)
  if (!cu?.customer_name && !cu?.phone_number) return null
  return <div className="whofor"><b>{cu.customer_name}</b>{cu.phone_number && <a href={`tel:${cu.phone_number}`}>📞 {cu.phone_number}</a>}</div>
}
