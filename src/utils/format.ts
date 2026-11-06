// Consistent date formatting throughout the app.
export const when=(iso?:string)=>iso?new Intl.DateTimeFormat('en',{month:'short',day:'numeric',year:'numeric'}).format(new Date(iso)):'—';
