/** A compact, consistent title row for the authenticated workspace. */
export function PageHeading({title,description}:{title:string;description:string}){
  return <section className="page-heading" aria-label={`${title} page heading`}>
    <h1>{title}<span className="page-heading-dot" aria-hidden="true">.</span></h1>
    <p>{description}</p>
  </section>;
}
