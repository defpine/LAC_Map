export function PopupBanner({ url }: { url?: string }) {
  if (!url) return null;
  return <div className="popup-banner" key={url}><img src={url} alt="장소 미리보기" onError={(event) => { event.currentTarget.parentElement!.hidden = true; }} /></div>;
}
