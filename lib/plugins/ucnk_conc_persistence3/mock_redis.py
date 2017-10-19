import json


class MockRedis:
    """
    mock the necessary methods of the redis db plugin
    """
    conc_prefix = "concordance:"

    def __init__(self):
        self.concordances = []
        self.arch_queue = []

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
        res = default
        for t in self.concordances:
            if t[0] == key:
                res = json.loads(t[1])
                break
        return res

    def lpop(self, arch_key):
        # param arch_key is only used to simulate a redis call
        popped = self.arch_queue.pop(0)
        return json.dumps(popped)

    def list_append(self, archive_queue_key, value_dict):
        self.arch_queue.append(value_dict)

    def llen(self, key):
        if key == "conc_arch_queue":
            return len(self.arch_queue)

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

    def get_keys(self):
        keys = []
        for i in self.concordances:
            keys.append(i[0][len(self.conc_prefix):])
        return keys

    def fill_concordances(self, size):
        for i in range(0, size):
            self.concordances.append((self.conc_prefix + 'key' + str(i), json.dumps('value' + str(i))))

    def fill_arch_queue(self, size):
        for i in range(0, size):
            item = dict(key=json.dumps('key' + str(i)))
            self.arch_queue.append(item)
