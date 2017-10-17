import json


class MockRedis:
    """
    mock the necessary methods of the redis db plugin
    """
    prefix = "concordance:"

    def __init__(self):
        self.concordances = []
        self.arch_queue = []
        # data in redis is stored as string(key), jsonString(value)
        # concordances and archive_queue should be rather filled using the ConcPersistance.store method
        # fill "concordances":
        """
        for i in range(0, size):
            self.concordances.append((self.prefix + 'key' + str(i), json.dumps('value' + str(i))))
            """
        # fill "archive queue":
        """
        for i in range(0, size / 2):
            item = dict(key=json.dumps('key' + str(i)))
            self.arch_queue.append(item)
            """

    def set(self, key, data):
        """
        Saves 'data' with 'key'.

        arguments:
        key -- an access key
        data -- a dictionary containing data to be saved
        """
        self.concordances.append([key, json.dumps(data)])

    def set_ttl(self, key, ttl):
        pass

    def get(self, key, default=None):
        res = None
        for t in self.concordances:
            if t[0] == key:
                res = t[1]
                break
        return res

    def lpop(self, arch_key):
        # param arch_key is only used to simulate a redis call
        return self.arch_queue.pop(0)

    def list_append(self, archive_queue_key, dict):
        self.arch_queue.append(dict)

    # ----------------
    # extra methods:
    # ----------------
    def clear(self):
        del self.arch_queue[:]
        del self.concordances[:]

    def get_first_key(self):
        return self.concordances[0][0]

    def get_arch_queue(self):
        return self.arch_queue

    def get_concordances(self):
        return self.concordances

    def print_arch_queue(self):
        for i in self.arch_queue:
            print (i)

    def print_concordances(self):
        for i in self.concordances:
            print (i)


"""
mock = MockRedis(10)
print("concordances:")
mock.print_concordances()
print("queue:")
mock.print_arch_queue()
print("pop one:")
qitem = mock.lpop('key')
print "quitem:", qitem
key = json.loads(qitem['key'])
# = qitem['key']
# print "key:", key
print key, json.loads(mock.get(key))

print("after popping:")
mock.print_arch_queue()

"""
