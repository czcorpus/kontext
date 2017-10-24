class MockAuth:
    def __init__(self):
        pass

    @staticmethod
    def is_anonymous(user_id):
        """
        any user_id other than 1 is authenticated
        """
        return user_id != 1
