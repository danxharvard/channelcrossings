// www.channelcrossings.world → channelcrossings.world, keeping the path and query
export default {
  fetch(request) {
    const url = new URL(request.url);
    url.hostname = 'channelcrossings.world';
    return Response.redirect(url.toString(), 301);
  },
};
