import gevent
from gevent import monkey
from gevent.pywsgi import WSGIServer
from geventwebsocket.handler import WebSocketHandler
import json
import os
import redis
import wsgi_helpers

_SUBSCRIBERS = {}

_PORT = int(os.environ.get("PORT", 8080))
_HOSTNAME = os.environ.get("HOSTNAME", "")
_REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
_REDIS_PORT = int(os.environ.get("REDIS_HOST", 6379))
_REDIS_QUEUE = os.environ.get("REDIS_QUEUE", "sillyvideotest")
_REDIS_CLIENT = None


def monitor_redis():
    client = redis.StrictRedis(host=_REDIS_HOST, port=_REDIS_PORT).pubsub()
    client.subscribe(_REDIS_QUEUE)
    for message in client.listen():
        if message["type"] == "subscribe":
            continue
        send_to_subscribers(message["data"])


def handle_websocket(environ, start_response):
    websocket = environ["wsgi.websocket"]
    user_id = None
    try:
        while True:
            packet = websocket.receive()
            if not user_id:
                data = json.loads(packet)
                user_id = data["user"]
                _SUBSCRIBERS[user_id] = websocket
            if packet is None:
                break
            broadcast(packet)

    finally:
        remove_user(user_id)


def remove_user(user_id):
    if user_id in _SUBSCRIBERS:
        del _SUBSCRIBERS[user_id]
    broadcast(json.dumps({
        "user": user_id,
        "type": "close"
    }))


def broadcast(message):
    _REDIS_CLIENT.publish(_REDIS_QUEUE, message)


def send_to_subscribers(message):
    for user_id, subscriber in _SUBSCRIBERS.items()[:]:
        try:
            subscriber.send(message)
        except Exception, exc:
            print exc
            remove_user(user_id)


def main():
    global _REDIS_CLIENT

    monkey.patch_all()
    gevent.spawn(monitor_redis)

    _REDIS_CLIENT = redis.StrictRedis(host=_REDIS_HOST, port=_REDIS_PORT)

    router = wsgi_helpers.Router([
        ("/", wsgi_helpers.handle_file("views/index.htm")),
        ("/websocket", handle_websocket),
        ("/static/.+", wsgi_helpers.handle_static("/static"))
    ])

    print "SERVING ON %s:%d" % (_HOSTNAME, _PORT)
    server = WSGIServer(
        (_HOSTNAME, _PORT), router, handler_class=WebSocketHandler)
    server.serve_forever()


if __name__ == "__main__":
    main()
