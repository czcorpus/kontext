from typing import List, Any, Iterator, Dict, Union


class LinesGroups:
    """
    Handles concordance lines groups manually defined by a user.
    It is expected that the controller has always an instance of
    this class available (i.e. no None value).
    """

    def __init__(self, data: List[Any]) -> None:
        if not isinstance(data, list):
            raise ValueError('LinesGroups data argument must be a list')
        self.data = data
        self.sorted = False

    def __len__(self) -> int:
        return len(self.data) if self.data else 0

    def __iter__(self) -> Iterator:
        return iter(self.data) if self.data else iter([])

    def serialize(self) -> Dict[str, Any]:
        return {'data': self.data, 'sorted': self.sorted}

    def as_list(self) -> List[Any]:
        return self.data if self.data else []

    def is_defined(self) -> bool:
        return len(self.data) > 0

    @staticmethod
    def deserialize(data: Union[Dict, List[Any]]) -> 'LinesGroups':
        data_dict = dict(data) if isinstance(data, list) else data
        ans = LinesGroups(data_dict.get('data', []))
        ans.sorted = data_dict.get('sorted', False)
        return ans
